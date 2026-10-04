import type { AddressInfo } from 'node:net'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { VERSAO_API } from '../../src/config/versao'
import { PrismaService, type ClienteBase } from '../../src/infra/prisma/prisma.service'
import { TIMEOUT_BANCO_MS } from '../../src/modules/health/health.service'
import type { AppDeTeste, OpcoesCriarApp } from '../setup/criar-app'
import { ProxyController } from '../suporte/proxy.controller'

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

// O ConfigModule valida a env ao importar o AppModule: o GIT_COMMIT_SHA precisa existir antes.
async function criarAppComCommit(opcoes?: OpcoesCriarApp): Promise<AppDeTeste> {
  const original = process.env.GIT_COMMIT_SHA
  process.env.GIT_COMMIT_SHA = SHA
  try {
    const { criarApp } =
      jest.requireActual<typeof import('../setup/criar-app')>('../setup/criar-app')
    return await criarApp(opcoes)
  } finally {
    if (original === undefined) delete process.env.GIT_COMMIT_SHA
    else process.env.GIT_COMMIT_SHA = original
  }
}

function clienteBase(app: INestApplication): ClienteBase {
  // eslint-disable-next-line no-restricted-syntax -- o /health consulta o banco pelo semEscopo
  return app.get(PrismaService).semEscopo
}

describe('GET /api/v1/health (#46)', () => {
  let contexto: AppDeTeste
  let banco: ClienteBase

  beforeAll(async () => {
    contexto = await criarAppComCommit({ controllers: [ProxyController] })
    banco = clienteBase(contexto.app)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  it('banco no ar, sem token → 200 com versão do package.json e commit do GIT_COMMIT_SHA', async () => {
    const resposta = await request(contexto.http).get('/api/v1/health')

    expect(resposta.status).toBe(200)
    expect(resposta.body).toEqual({
      status: 'ok',
      versao: VERSAO_API,
      commit: SHA.slice(0, 7),
      banco: 'ok',
    })
    expect(resposta.headers['cache-control']).toBe('no-store')
  })

  it('SELECT 1 rejeitado → 503 sem o formato de erro padrão', async () => {
    jest
      .spyOn(banco, '$queryRaw')
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.1:5432'))

    const resposta = await request(contexto.http).get('/api/v1/health')

    expect(resposta.status).toBe(503)
    expect(resposta.body).toEqual({
      status: 'erro',
      versao: VERSAO_API,
      commit: SHA.slice(0, 7),
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
    expect(duracao).toBeGreaterThanOrEqual(TIMEOUT_BANCO_MS - 100)
    expect(duracao).toBeLessThan(TIMEOUT_BANCO_MS + 1000)
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
    const { app } = await criarAppComCommit()
    await app.listen(0)
    const servidor = app.getHttpServer()
    expect((servidor.address() as AddressInfo).port).toBeGreaterThan(0)
    const desconectar = jest.spyOn(clienteBase(app), '$disconnect')

    await app.close()

    expect(servidor.listening).toBe(false)
    expect(desconectar).toHaveBeenCalledTimes(1)
  })
})
