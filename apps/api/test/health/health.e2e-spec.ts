import type { AddressInfo } from 'node:net'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService, type ClienteBase } from '../../src/infra/prisma/prisma.service'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { ProxyController } from '../suporte/proxy.controller'

const { version } = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
) as { version: string }

function clienteBase(app: INestApplication): ClienteBase {
  // eslint-disable-next-line no-restricted-syntax -- o /health consulta o banco pelo semEscopo
  return app.get(PrismaService).semEscopo
}

const VARIAVEIS_COMMIT = ['GIT_COMMIT_SHA', 'RAILWAY_GIT_COMMIT_SHA'] as const

describe('GET /api/v1/health (#46)', () => {
  let contexto: AppDeTeste
  let banco: ClienteBase
  const originais = Object.fromEntries(VARIAVEIS_COMMIT.map((nome) => [nome, process.env[nome]]))

  beforeAll(async () => {
    contexto = await criarApp({ controllers: [ProxyController] })
    banco = clienteBase(contexto.app)
  })

  beforeEach(() => {
    for (const nome of VARIAVEIS_COMMIT) delete process.env[nome]
  })

  afterEach(() => {
    jest.restoreAllMocks()
    for (const nome of VARIAVEIS_COMMIT) {
      if (originais[nome] === undefined) delete process.env[nome]
      else process.env[nome] = originais[nome]
    }
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  it('banco no ar, sem token → 200 com versão do package.json e commit do GIT_COMMIT_SHA', async () => {
    process.env.GIT_COMMIT_SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

    const resposta = await request(contexto.http).get('/api/v1/health')

    expect(resposta.status).toBe(200)
    expect(resposta.body).toEqual({ status: 'ok', versao: version, commit: 'a1b2c3d', banco: 'ok' })
    expect(resposta.headers['cache-control']).toBe('no-store')
  })

  it('sem GIT_COMMIT_SHA → commit "desconhecido"', async () => {
    const resposta = await request(contexto.http).get('/api/v1/health')

    expect(resposta.status).toBe(200)
    expect(resposta.body).toMatchObject({ commit: 'desconhecido' })
  })

  it('SELECT 1 rejeitado → 503 sem o formato de erro padrão', async () => {
    jest
      .spyOn(banco, '$queryRaw')
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.1:5432'))

    const resposta = await request(contexto.http).get('/api/v1/health')

    expect(resposta.status).toBe(503)
    expect(resposta.body).toEqual({
      status: 'erro',
      versao: version,
      commit: 'desconhecido',
      banco: 'indisponivel',
    })
    expect(resposta.text).not.toMatch(/ECONNREFUSED|10\.0\.0\.1/)
  })

  it('SELECT 1 sem resposta → 503 em até 3 s', async () => {
    jest
      .spyOn(banco, '$queryRaw')
      .mockReturnValueOnce(new Promise(() => {}) as ReturnType<ClienteBase['$queryRaw']>)

    const inicio = performance.now()
    const resposta = await request(contexto.http).get('/api/v1/health')
    const duracao = performance.now() - inicio

    expect(resposta.status).toBe(503)
    expect(resposta.body).toMatchObject({ status: 'erro', banco: 'indisponivel' })
    expect(duracao).toBeGreaterThanOrEqual(1900)
    expect(duracao).toBeLessThan(3000)
  })

  it('Swagger documenta a rota como pública, com 200 e 503', async () => {
    const doc = await request(contexto.http).get('/api/docs-json')
    const operacao = (doc.body as { paths: Record<string, { get: Record<string, unknown> }> })
      .paths['/api/v1/health']?.get

    expect(operacao).toBeDefined()
    expect(operacao?.security).toBeUndefined()
    expect(Object.keys(operacao?.responses as object).sort()).toEqual(['200', '503'])
  })

  describe('trust proxy', () => {
    it('req.ip é o IP do X-Forwarded-For enviado pelo proxy', async () => {
      const resposta = await request(contexto.http)
        .get('/api/v1/suporte/proxy/ip')
        .set('X-Forwarded-For', '203.0.113.7')

      expect(resposta.body).toEqual({ ip: '203.0.113.7' })
    })

    it('ignora IPs forjados pelo cliente antes do adicionado pelo proxy', async () => {
      const resposta = await request(contexto.http)
        .get('/api/v1/suporte/proxy/ip')
        .set('X-Forwarded-For', '198.51.100.1, 203.0.113.7')

      expect(resposta.body).toEqual({ ip: '203.0.113.7' })
    })
  })
})

describe('encerramento da API (#46)', () => {
  it('app.close() (chamado no SIGTERM) fecha o servidor HTTP e desconecta o Prisma', async () => {
    const { app } = await criarApp()
    await app.listen(0)
    const servidor = app.getHttpServer()
    expect((servidor.address() as AddressInfo).port).toBeGreaterThan(0)
    const desconectar = jest.spyOn(clienteBase(app), '$disconnect')

    await app.close()

    expect(servidor.listening).toBe(false)
    expect(desconectar).toHaveBeenCalledTimes(1)
  })
})
