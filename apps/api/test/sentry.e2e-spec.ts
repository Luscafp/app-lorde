import type { NestExpressApplication } from '@nestjs/platform-express'
import * as Sentry from '@sentry/nestjs'
import request from 'supertest'
import type { App } from 'supertest/types'
import { opcoesSentry } from '../src/infra/sentry/sentry'
import { criarApp } from './setup/criar-app'
import {
  ATLETICA_TESTE,
  ObservabilidadeController,
  USUARIO_TESTE,
} from './suporte/observabilidade.controller'

type Linha = Record<string, unknown>

describe('Sentry com o SDK real (#48, critério 5 do épico #5)', () => {
  const envelopes: string[] = []
  let app: NestExpressApplication
  let http: App

  /** O evento como sairia pela rede: já passou pelo `beforeSend` e pela serialização do SDK. */
  function eventoEnviado(): Sentry.ErrorEvent | undefined {
    return envelopes
      .flatMap((envelope) => envelope.split('\n'))
      .filter((linha) => linha.startsWith('{'))
      .map((linha) => JSON.parse(linha) as Linha)
      .find((item) => 'exception' in item) as Sentry.ErrorEvent | undefined
  }

  beforeAll(async () => {
    Sentry.init({
      ...opcoesSentry({
        APP_ENV: 'homologacao',
        SENTRY_DSN: 'https://chave@o1.ingest.sentry.io/1',
        SENTRY_TRACES_SAMPLE_RATE: 0,
      }),
      transport: (opcoes) =>
        Sentry.createTransport(opcoes, ({ body }) => {
          envelopes.push(typeof body === 'string' ? body : new TextDecoder().decode(body))
          return Promise.resolve({})
        }),
    })
    ;({ app, http } = await criarApp({ controllers: [ObservabilidadeController] }))
  })

  afterAll(async () => {
    await app.close()
    await Sentry.close()
  })

  it('500 → environment, tags e usuário só com id; sem corpo, Authorization nem e-mail', async () => {
    const resposta = await request(http)
      .get('/api/v1/suporte/autenticada/erro')
      .set('Authorization', 'Bearer token-do-cliente')
      .set('Cookie', 'sessao=segredo')
    await Sentry.flush()

    const evento = eventoEnviado()
    expect(evento).toMatchObject({
      environment: 'homologacao',
      user: { id: USUARIO_TESTE },
      tags: {
        requestId: resposta.headers['x-request-id'],
        route: '/api/v1/suporte/autenticada/erro',
        atleticaId: ATLETICA_TESTE,
      },
    })
    expect(Object.keys(evento?.user ?? {})).toEqual(['id'])
    expect(evento?.request?.data).toBeUndefined()
    expect(evento?.request?.headers).not.toHaveProperty('authorization')
    expect(evento?.request?.headers).not.toHaveProperty('cookie')
    expect(evento?.exception?.values?.[0]?.value).toBe('falha de [email]')
    const texto = envelopes.join('\n')
    for (const sensivel of ['token-do-cliente', 'segredo']) {
      expect(texto).not.toContain(sensivel)
    }
  })
})
