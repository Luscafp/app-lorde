import * as Sentry from '@sentry/nestjs'
import type { Request } from 'express'
import { vincularContexto } from '../contexto/contexto-requisicao'
import {
  beforeSend,
  capturarErroHttp,
  capturarErroJob,
  COLETA_MINIMA,
  opcoesSentry,
} from './sentry'

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }))

describe('beforeSend', () => {
  function evento(): Sentry.ErrorEvent {
    return {
      type: undefined,
      message: 'Falha para fulano@ufma.br',
      request: {
        url: 'https://api/x',
        data: { senha: 'segredo' },
        cookies: { sessao: 'abc' },
        headers: { Authorization: 'Bearer token', cookie: 'a=b', 'user-agent': 'app' },
      },
      extra: { para: 'fulano@ufma.br', aninhado: { lista: ['ciclano@ex.com'] }, total: 2 },
      exception: { values: [{ type: 'Error', value: 'Usuário fulano@ufma.br não achado' }] },
      user: { id: 'u1', email: 'fulano@ufma.br', ip_address: '1.2.3.4' },
    }
  }

  it('remove corpo, cookies e Authorization', () => {
    const { request } = beforeSend(evento())
    expect(request).toEqual({ url: 'https://api/x', headers: { 'user-agent': 'app' } })
  })

  it('troca e-mails por [email] em message, extra e exceção', () => {
    const resultado = beforeSend(evento())
    expect(resultado.message).toBe('Falha para [email]')
    expect(resultado.extra).toEqual({ para: '[email]', aninhado: { lista: ['[email]'] }, total: 2 })
    expect(resultado.exception?.values?.[0]?.value).toBe('Usuário [email] não achado')
  })

  it('mantém só user.id', () => {
    expect(beforeSend(evento()).user).toEqual({ id: 'u1' })
    expect(beforeSend({ ...evento(), user: { email: 'a@b.c' } }).user).toBeUndefined()
  })
})

describe('opcoesSentry', () => {
  it('sem SENTRY_DSN → undefined (Sentry desligado)', () => {
    expect(
      opcoesSentry({ APP_ENV: 'local', SENTRY_DSN: undefined, SENTRY_TRACES_SAMPLE_RATE: 0.1 }),
    ).toBeUndefined()
  })

  it('environment = APP_ENV, release api@<versao>+<commit>, coleta mínima', () => {
    const opcoes = opcoesSentry({
      APP_ENV: 'homologacao',
      SENTRY_DSN: 'https://chave@o1.ingest.sentry.io/1',
      SENTRY_TRACES_SAMPLE_RATE: 1,
    })
    expect(opcoes).toMatchObject({
      dsn: 'https://chave@o1.ingest.sentry.io/1',
      environment: 'homologacao',
      release: expect.stringMatching(/^api@\d+\.\d+\.\d+\+\w+$/) as string,
      tracesSampleRate: 1,
      dataCollection: COLETA_MINIMA,
      beforeSend,
    })
    expect(COLETA_MINIMA).toMatchObject({ userInfo: false, httpBodies: [], cookies: false })
  })
})

describe('captura', () => {
  beforeEach(() => jest.mocked(Sentry.captureException).mockClear())

  it('capturarErroHttp: tags requestId/route/atleticaId e usuário só com id', () => {
    const req = { baseUrl: '', route: { path: '/api/v1/eventos/:id' } } as unknown as Request
    vincularContexto(req, { requestId: 'r1', usuarioId: 'u1', atleticaId: 'a1' })
    const erro = new Error('x')
    capturarErroHttp(erro, req)
    expect(Sentry.captureException).toHaveBeenCalledWith(erro, {
      user: { id: 'u1' },
      tags: { requestId: 'r1', route: '/api/v1/eventos/:id', atleticaId: 'a1' },
    })
  })

  it('capturarErroJob: tag job=<nome>', () => {
    const erro = new Error('x')
    capturarErroJob('notificacao.confirmacao-pendente', erro, { eventoId: 'e1' })
    expect(Sentry.captureException).toHaveBeenCalledWith(erro, {
      tags: { job: 'notificacao.confirmacao-pendente' },
      extra: { eventoId: 'e1' },
    })
  })
})
