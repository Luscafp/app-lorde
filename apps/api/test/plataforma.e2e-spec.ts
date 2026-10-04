import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { validarEnv, type Env } from '../src/config/env.schema'
import { configurarApp } from '../src/configurar-app'
import { ExemploController } from './suporte/exemplo.controller'

async function criarAppPlataforma(env: Partial<Env> = {}): Promise<NestExpressApplication> {
  const config = { ...validarEnv(process.env), ...env }
  const modulo = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ExemploController],
  })
    .overrideProvider(ConfigService)
    .useValue({ get: (chave: keyof Env) => config[chave] })
    .compile()

  const app = modulo.createNestApplication<NestExpressApplication>({ bodyParser: false })
  configurarApp(app)
  await app.init()
  return app
}

describe('Plataforma da API (#1)', () => {
  let app: NestExpressApplication
  let http: App

  beforeAll(async () => {
    app = await criarAppPlataforma({ NODE_ENV: 'development' })
    http = app.getHttpServer()
  })

  afterAll(async () => {
    await app.close()
  })

  it('corpo inválido para DTO do shared → 400 VALIDATION_ERROR com details', async () => {
    const resposta = await request(http).post('/api/v1/exemplo/validacao').send({ page: 0 })
    expect(resposta.status).toBe(400)
    expect(resposta.body).toEqual({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos.',
      details: [{ field: 'page', message: expect.any(String) as string }],
    })
  })

  it('corpo válido passa pelo ZodValidationPipe com os padrões aplicados', async () => {
    const resposta = await request(http).post('/api/v1/exemplo/validacao').send({ limit: '10' })
    expect(resposta.status).toBe(200)
    expect(resposta.body).toEqual({ page: 1, limit: 10 })
  })

  it('ErroNegocio → 409 com code e details []', async () => {
    const resposta = await request(http).get('/api/v1/exemplo/conflito')
    expect(resposta.status).toBe(409)
    expect(resposta.body).toEqual({
      statusCode: 409,
      code: 'EXEMPLO_CONFLITO',
      message: 'Mensagem',
      details: [],
    })
  })

  it('erro inesperado → 500 genérico, sem stack nem mensagem original', async () => {
    const resposta = await request(http).get('/api/v1/exemplo/erro')
    expect(resposta.status).toBe(500)
    expect(resposta.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Ocorreu um erro inesperado. Tente novamente.',
      details: [],
    })
    expect(resposta.text).not.toMatch(/stack|at |"x"/)
  })

  it('rota inexistente → 404 NOT_FOUND', async () => {
    const resposta = await request(http).get('/api/v1/nao-existe')
    expect(resposta.status).toBe(404)
    expect(resposta.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND', details: [] })
  })

  it('corpo JSON de 150 kB → 413 PAYLOAD_TOO_LARGE', async () => {
    const resposta = await request(http)
      .post('/api/v1/exemplo/corpo')
      .send({ texto: 'a'.repeat(150 * 1024) })
    expect(resposta.status).toBe(413)
    expect(resposta.body).toMatchObject({ statusCode: 413, code: 'PAYLOAD_TOO_LARGE' })
  })

  it('corpo JSON abaixo do limite é aceito', async () => {
    const resposta = await request(http)
      .post('/api/v1/exemplo/corpo')
      .send({ texto: 'a'.repeat(50 * 1024) })
    expect(resposta.status).toBe(200)
  })

  it('aplica os cabeçalhos do helmet', async () => {
    const resposta = await request(http).get('/api/v1/nao-existe')
    expect(resposta.headers['x-content-type-options']).toBe('nosniff')
  })

  it('Swagger disponível em /api/docs fora de produção, com esquema bearer', async () => {
    expect((await request(http).get('/api/docs')).status).toBe(200)
    const doc = await request(http).get('/api/docs-json')
    expect(doc.body).toMatchObject({
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
    })
  })
})

describe('Swagger em produção (#1)', () => {
  it('/api/docs → 404 NOT_FOUND', async () => {
    const app = await criarAppPlataforma({ NODE_ENV: 'production' })
    try {
      const resposta = await request(app.getHttpServer()).get('/api/docs')
      expect(resposta.status).toBe(404)
      expect(resposta.body).toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await app.close()
    }
  })
})
