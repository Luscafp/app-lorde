import type { NestExpressApplication } from '@nestjs/platform-express'
import * as Sentry from '@sentry/nestjs'
import { PARAMS_PROVIDER_TOKEN } from 'nestjs-pino'
import request from 'supertest'
import type { App } from 'supertest/types'
import { criarConfigLogger } from '../src/infra/logs/logger.config'
import { UUID_V4 } from '../src/infra/logs/request-id.middleware'
import { tokenPara } from './fabricas/auth'
import { criarUsuario } from './fabricas/usuario'
import { criarApp } from './setup/criar-app'
import { ObservabilidadeController } from './suporte/observabilidade.controller'

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }))

type Linha = Record<string, unknown>

describe('Observabilidade da API (#48)', () => {
  const linhas: Linha[] = []
  let app: NestExpressApplication
  let http: App

  const acessos = () => linhas.filter((linha) => linha.msg === 'Requisição concluída')

  /** 500 numa rota autenticada pelo `JwtAuthGuard` (#7) com token real. */
  async function erroAutenticado() {
    const usuario = await criarUsuario()
    const token = await tokenPara(usuario)
    linhas.length = 0
    const resposta = await request(http)
      .get('/api/v1/suporte/autenticada/erro')
      .set('Authorization', `Bearer ${token}`)
    return { usuario, resposta }
  }

  beforeAll(async () => {
    const params = criarConfigLogger({ NODE_ENV: 'test', LOG_LEVEL: 'debug', APP_ENV: 'local' })
    const destino = { write: (linha: string) => linhas.push(JSON.parse(linha) as Linha) }
    ;({ app, http } = await criarApp({
      controllers: [ObservabilidadeController],
      ajustar: (modulo) =>
        modulo
          .overrideProvider(PARAMS_PROVIDER_TOKEN)
          .useValue({ ...params, pinoHttp: [params.pinoHttp, destino] }),
    }))
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    linhas.length = 0
    jest.mocked(Sentry.captureException).mockClear()
  })

  describe('requestId', () => {
    it('sem X-Request-Id → gera UUID, devolve no cabeçalho e usa no log de acesso', async () => {
      const resposta = await request(http).get('/api/v1/suporte/eventos/1')
      const id = resposta.headers['x-request-id']
      expect(id).toMatch(UUID_V4)
      expect(acessos()).toEqual([expect.objectContaining({ requestId: id })])
    })

    it('X-Request-Id UUID v4 do cliente é mantido', async () => {
      const id = '0b6c2f0e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'
      const resposta = await request(http).get('/api/v1/suporte/eventos/1').set('X-Request-Id', id)
      expect(resposta.headers['x-request-id']).toBe(id)
      expect(acessos()[0]).toMatchObject({ requestId: id })
    })

    it('X-Request-Id: abc → ignorado, gera outro UUID', async () => {
      const resposta = await request(http)
        .get('/api/v1/suporte/eventos/1')
        .set('X-Request-Id', 'abc')
      expect(resposta.headers['x-request-id']).toMatch(UUID_V4)
      expect(JSON.stringify(linhas)).not.toContain('"abc"')
    })

    it('todo log da requisição tem o mesmo requestId', async () => {
      const resposta = await request(http)
        .post('/api/v1/suporte/auth/login')
        .send({ email: 'fulano@ufma.br', senha: 'Segredo#123' })
      const id = resposta.headers['x-request-id']
      expect(linhas.length).toBeGreaterThanOrEqual(2)
      expect(linhas.every((linha) => linha.requestId === id)).toBe(true)
    })
  })

  describe('log de acesso', () => {
    it('rota parametrizada, campos fixos e appVersion', async () => {
      const id = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a'
      await request(http).get(`/api/v1/suporte/eventos/${id}`).set('X-App-Version', '1.2.3')
      const [acesso] = acessos()
      expect(acesso).toMatchObject({
        level: 30,
        service: 'api',
        env: 'local',
        version: expect.stringMatching(/\+/) as string,
        method: 'GET',
        route: '/api/v1/suporte/eventos/:id',
        statusCode: 200,
        durationMs: expect.any(Number) as number,
        appVersion: '1.2.3',
      })
      expect(JSON.stringify(acesso)).not.toContain(id)
    })

    it('rota inexistente → sem route', async () => {
      await request(http).get('/api/v1/nao-existe/123')
      expect(acessos()[0]).toMatchObject({ level: 40, statusCode: 404 })
      expect(acessos()[0]).not.toHaveProperty('route')
    })

    it('4xx → warn; 5xx → error, com usuarioId e atleticaId do contexto', async () => {
      await request(http).get('/api/v1/suporte/conflito')
      expect(acessos()[0]).toMatchObject({ level: 40, statusCode: 409 })

      const { usuario } = await erroAutenticado()
      expect(acessos()[0]).toMatchObject({
        level: 50,
        statusCode: 500,
        route: '/api/v1/suporte/autenticada/erro',
        usuarioId: usuario.id,
        atleticaId: usuario.atleticaId,
      })
    })

    it('login: nenhuma linha contém senha, e-mail, token nem query string', async () => {
      await request(http)
        .post('/api/v1/suporte/auth/login?email=fulano@ufma.br')
        .set('Authorization', 'Bearer token-do-cliente')
        .send({ email: 'fulano@ufma.br', senha: 'Segredo#123' })
      const texto = JSON.stringify(linhas)
      for (const sensivel of [
        'Segredo#123',
        'fulano@ufma.br',
        'token-secreto',
        'token-do-cliente',
      ]) {
        expect(texto).not.toContain(sensivel)
      }
      expect(linhas.find((linha) => linha.msg === 'Tentativa de login')).toMatchObject({
        corpo: { email: '[REDACTED]', senha: '[REDACTED]' },
      })
    })
  })

  describe('Sentry', () => {
    it('500 → captureException com tags requestId/route e usuário só com id', async () => {
      const { usuario, resposta } = await erroAutenticado()
      expect(Sentry.captureException).toHaveBeenCalledTimes(1)
      expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
        user: { id: usuario.id },
        tags: {
          requestId: resposta.headers['x-request-id'],
          route: '/api/v1/suporte/autenticada/erro',
          atleticaId: usuario.atleticaId,
        },
      })
    })

    it('401, 404 e 409 → não vão ao Sentry', async () => {
      await request(http).get('/api/v1/suporte/autenticada/erro')
      await request(http).get('/api/v1/nao-existe')
      await request(http).get('/api/v1/suporte/conflito')
      expect(Sentry.captureException).not.toHaveBeenCalled()
    })
  })
})
