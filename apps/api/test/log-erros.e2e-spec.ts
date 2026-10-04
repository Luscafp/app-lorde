import type { NestExpressApplication } from '@nestjs/platform-express'
import request from 'supertest'
import { criarAppPlataforma } from './suporte/criar-app-plataforma'

// Arquivo próprio: o nestjs-pino mantém um logger raiz único por processo, criado pelo primeiro app.
describe('Log de erros (#1)', () => {
  const linhas: Record<string, unknown>[] = []
  let app: NestExpressApplication

  beforeAll(async () => {
    app = await criarAppPlataforma({}, linhas)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    linhas.length = 0
  })

  it('erro inesperado → log error com o stack', async () => {
    await request(app.getHttpServer()).get('/api/v1/exemplo/erro')
    const registro = linhas.find((linha) => linha.msg === 'Erro inesperado')
    expect(registro).toMatchObject({
      level: 50,
      code: 'INTERNAL_ERROR',
      method: 'GET',
      url: '/api/v1/exemplo/erro',
      err: { message: 'x', stack: expect.stringMatching(/^Error: x\n\s+at /) as string },
    })
  })

  it('o cabeçalho Authorization é redigido no log', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/exemplo/erro')
      .set('Authorization', 'Bearer token-secreto')
    expect(linhas.length).toBeGreaterThan(0)
    expect(JSON.stringify(linhas)).not.toContain('token-secreto')
  })

  it('erro 4xx → log warn sem o corpo da requisição', async () => {
    await request(app.getHttpServer()).post('/api/v1/exemplo/validacao').send({ page: 0 })
    const registro = linhas.find((linha) => linha.code === 'VALIDATION_ERROR')
    expect(registro).toMatchObject({ level: 40, statusCode: 400 })
    expect(JSON.stringify(registro)).not.toMatch(/"page"/)
  })
})
