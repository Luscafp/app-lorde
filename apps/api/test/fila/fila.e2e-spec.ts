import { FUSO_PADRAO } from '@atletica/shared'
import type { NestExpressApplication } from '@nestjs/platform-express'
import * as Sentry from '@sentry/nestjs'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { ContextoAtletica } from '../../src/infra/contexto/contexto-atletica.service'
import { FilaService, type OpcoesFila } from '../../src/infra/fila/fila.service'
import { PrismaService } from '../../src/infra/prisma/prisma.service'
import { criarApp } from '../setup/criar-app'
import { aguardarCondicao, aguardarFilaVazia, processarFilas } from '../setup/fila'
import { prismaTeste } from '../setup/prisma-teste'

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }))

declare module '../../src/infra/fila/filas-dominio' {
  interface FilasDominio {
    [nome: `teste.${string}`]: { valor: number; atleticaId?: string }
  }
}

const RAIZ_API = join(__dirname, '..', '..')

async function estadoDoJob(id: string | null): Promise<string | undefined> {
  const [linha] = await prismaTeste.$queryRaw<{ state: string }[]>`
    SELECT state::text FROM pgboss.job WHERE id = ${id}::uuid`
  return linha?.state
}

async function contarJobs(nome: string): Promise<number> {
  const [linha] = await prismaTeste.$queryRaw<{ total: number }[]>`
    SELECT count(*)::int AS total FROM pgboss.job WHERE name = ${nome}`
  return linha?.total ?? 0
}

describe('fila (pg-boss)', () => {
  let app: NestExpressApplication
  let fila: FilaService

  beforeAll(async () => {
    ;({ app } = await criarApp())
    fila = app.get(FilaService)
  }, 60_000)

  beforeEach(() => {
    jest.mocked(Sentry.captureException).mockClear()
  })

  afterAll(async () => {
    await app.close()
  })

  it('envia e processa um job', async () => {
    const handler = jest.fn().mockResolvedValue(undefined)
    await fila.criarFila('teste.processar')
    await fila.trabalhar('teste.processar', handler)

    const id = await fila.enviar('teste.processar', { valor: 7 })
    await processarFilas(app)

    expect(handler).toHaveBeenCalledWith({ valor: 7 }, expect.objectContaining({ id }))
    expect(await estadoDoJob(id)).toBe('completed')
  })

  describe('retry', () => {
    it('handler que falha 2 vezes conclui na 3ª tentativa, sem erro no Sentry', async () => {
      let tentativas = 0
      await fila.criarFila('teste.retry')
      await fila.trabalhar('teste.retry', () => {
        tentativas += 1
        return tentativas <= 2
          ? Promise.reject(new Error(`falha ${tentativas}`))
          : Promise.resolve()
      })

      const id = await fila.enviar('teste.retry', { valor: 1 }, { retryLimit: 3 })
      await aguardarFilaVazia(app, 'teste.retry')

      expect(tentativas).toBe(3)
      expect(await estadoDoJob(id)).toBe('completed')
      expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('esgotadas as tentativas, só o erro final vai ao Sentry', async () => {
      let tentativas = 0
      await fila.criarFila('teste.retry-esgotado')
      await fila.trabalhar('teste.retry-esgotado', () => {
        tentativas += 1
        return Promise.reject(new Error(`falha ${tentativas}`))
      })

      const id = await fila.enviar('teste.retry-esgotado', { valor: 1 }, { retryLimit: 2 })
      await aguardarFilaVazia(app, 'teste.retry-esgotado')

      expect(tentativas).toBe(3)
      expect(await estadoDoJob(id)).toBe('failed')
      expect(Sentry.captureException).toHaveBeenCalledTimes(1)
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'falha 3' }),
        { tags: { job: 'teste.retry-esgotado' }, extra: { jobId: id, tentativa: 3 } },
      )
    })

    it('com backoff, a nova tentativa espera ao menos o retryDelay', async () => {
      await fila.criarFila('teste.backoff', { retryLimit: 3, retryDelay: 5, retryBackoff: true })
      await fila.trabalhar('teste.backoff', () => Promise.reject(new Error('falha')))

      const id = await fila.enviar('teste.backoff', { valor: 1 })
      await aguardarCondicao(async () => (await estadoDoJob(id)) === 'retry')

      const [job] = await prismaTeste.$queryRaw<{ adiado: boolean }[]>`
        SELECT start_after > now() + interval '5 seconds' AS adiado FROM pgboss.job WHERE id = ${id}::uuid`
      expect(job?.adiado).toBe(true)
    })
  })

  describe('singletonKey', () => {
    it.each<[NonNullable<OpcoesFila['policy']>, number]>([
      ['standard', 2],
      ['singleton', 2],
      ['short', 1],
      ['stately', 1],
      ['exclusive', 1],
    ])('política %s: dois envios com a mesma chave geram %i job(s)', async (policy, esperado) => {
      const nome = `teste.chave-${policy}` as const
      await fila.criarFila(nome, { policy })

      await fila.enviar(nome, { valor: 1 }, { singletonKey: 'evento-1' })
      await fila.enviar(nome, { valor: 2 }, { singletonKey: 'evento-1' })

      expect(await contarJobs(nome)).toBe(esperado)
    })

    it('política stately: o segundo envio devolve null e o handler roda uma vez', async () => {
      const handler = jest.fn().mockResolvedValue(undefined)
      await fila.criarFila('teste.stately', { policy: 'stately' })
      await fila.trabalhar('teste.stately', handler)

      const primeiro = await fila.enviar('teste.stately', { valor: 1 }, { singletonKey: 'k' })
      const segundo = await fila.enviar('teste.stately', { valor: 2 }, { singletonKey: 'k' })
      await aguardarFilaVazia(app, 'teste.stately')

      expect(primeiro).toEqual(expect.any(String))
      expect(segundo).toBeNull()
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  it('job com startAfter no futuro não é processado antes do horário', async () => {
    const handler = jest.fn().mockResolvedValue(undefined)
    await fila.criarFila('teste.adiado')
    await fila.trabalhar('teste.adiado', handler)

    const adiado = await fila.enviar(
      'teste.adiado',
      { valor: 1 },
      { startAfter: new Date(Date.now() + 60 * 60 * 1000) },
    )
    await fila.enviar('teste.adiado', { valor: 2 })
    await aguardarFilaVazia(app, 'teste.adiado')

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ valor: 2 }, expect.anything())
    expect(await estadoDoJob(adiado)).toBe('created')
  })

  it('registra cron com o fuso padrão', async () => {
    await fila.criarFila('teste.cron')
    await fila.agendar('teste.cron', '0 4 * * *')

    const agendamentos = await prismaTeste.$queryRaw<{ cron: string; timezone: string }[]>`
      SELECT cron, timezone FROM pgboss.schedule WHERE name = 'teste.cron'`
    expect(agendamentos).toEqual([{ cron: '0 4 * * *', timezone: FUSO_PADRAO }])
    expect(FUSO_PADRAO).toBe('America/Fortaleza')
  })

  it('handler roda no contexto da atlética do payload', async () => {
    const contexto = app.get(ContextoAtletica)
    const atleticaId = randomUUID()
    const vistos: (string | undefined)[] = []
    await fila.criarFila('teste.contexto')
    await fila.trabalhar('teste.contexto', () => {
      vistos.push(contexto.atleticaId())
      return Promise.resolve()
    })

    await fila.enviar('teste.contexto', { valor: 1, atleticaId })
    await fila.enviar('teste.contexto', { valor: 2 })
    await aguardarFilaVazia(app, 'teste.contexto')

    expect(vistos.sort()).toEqual([atleticaId, undefined].sort())
  })
})

describe('fila (pg-boss): ciclo de vida da API', () => {
  it('cria o schema pgboss na subida sem gerar drift no schema public', async () => {
    await prismaTeste.$executeRawUnsafe('DROP SCHEMA IF EXISTS pgboss CASCADE')

    const { app } = await criarApp()
    await app.close()

    const [schema] = await prismaTeste.$queryRaw<{ existe: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'pgboss') AS existe`
    expect(schema?.existe).toBe(true)
    expect(() =>
      execFileSync(
        process.execPath,
        [
          require.resolve('prisma/build/index.js'),
          'migrate',
          'diff',
          '--from-config-datasource',
          '--to-schema',
          'prisma/schema.prisma',
          '--exit-code',
        ],
        { cwd: RAIZ_API, env: process.env, stdio: 'pipe' },
      ),
    ).not.toThrow()
  }, 60_000)

  it('o encerramento gracioso aguarda o job em execução, com o banco ainda conectado', async () => {
    let liberar: () => void = () => undefined
    const bloqueio = new Promise<void>((resolver) => (liberar = resolver))
    let iniciou = false
    let concluiu = false
    const { app } = await criarApp()
    const fila = app.get(FilaService)
    // eslint-disable-next-line no-restricted-syntax -- o handler só confere que o banco segue no ar
    const banco = app.get(PrismaService).semEscopo
    await fila.criarFila('teste.encerramento')
    await fila.trabalhar('teste.encerramento', async () => {
      iniciou = true
      await bloqueio
      await banco.$queryRaw`SELECT 1`
      concluiu = true
    })

    const id = await fila.enviar('teste.encerramento', { valor: 1 })
    await aguardarCondicao(() => {
      fila.acordarWorkers()
      return iniciou
    })

    let fechou = false
    const fechamento = app.close().then(() => (fechou = true))
    await esperar(1_000)
    expect(fechou).toBe(false)

    liberar()
    await fechamento
    expect(concluiu).toBe(true)
    expect(await estadoDoJob(id)).toBe('completed')
  }, 60_000)
})
