import { Papel } from '@atletica/shared'
import * as Sentry from '@sentry/react-native'
import { renderHook } from '@testing-library/react-native'
import { ambiente } from '@/config/ambiente'
import {
  acompanharUsuario,
  iniciarSentry,
  iniciarSpanAbertura,
  limparBreadcrumb,
  limparEvento,
  marcarHomePronta,
  useMarcarHomePronta,
} from '@/infra/sentry'
import { useSessao } from '@/infra/sessao/store'

const DSN = 'https://chave@o1.ingest.sentry.io/1'
const globais = globalThis as typeof globalThis & { __DEV__: boolean }

beforeEach(() => jest.clearAllMocks())
afterEach(() => jest.restoreAllMocks())

describe('iniciarSentry', () => {
  it('sem DSN não inicializa nem envia nada', () => {
    jest.replaceProperty(ambiente, 'sentryDsn', undefined)
    iniciarSentry()
    expect(Sentry.init).not.toHaveBeenCalled()
    expect(Sentry.setUser).not.toHaveBeenCalled()
  })

  it('com DSN inicializa por ambiente, sem PII e desligado em __DEV__', () => {
    jest.replaceProperty(ambiente, 'sentryDsn', DSN)
    iniciarSentry()
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: DSN,
        environment: 'development',
        enabled: false,
        sendDefaultPii: false,
        beforeBreadcrumb: limparBreadcrumb,
        beforeSend: limparEvento,
      }),
    )
  })
})

describe('span inicio_home_pronta', () => {
  const startInactiveSpan = jest.mocked(Sentry.startInactiveSpan)

  function iniciarComSpan() {
    const end = jest.fn()
    startInactiveSpan.mockReturnValueOnce({ end } as unknown as ReturnType<
      typeof Sentry.startInactiveSpan
    >)
    jest.replaceProperty(ambiente, 'sentryDsn', DSN)
    iniciarSpanAbertura()
    return end
  }

  beforeEach(() => jest.replaceProperty(globais, '__DEV__', false))
  afterEach(() => marcarHomePronta())

  it('iniciado uma vez e finalizado uma única vez no primeiro render com dados', async () => {
    const end = iniciarComSpan()
    expect(startInactiveSpan).toHaveBeenCalledTimes(1)
    expect(startInactiveSpan).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'inicio_home_pronta', forceTransaction: true }),
    )

    const { rerender } = await renderHook(
      ({ comDados }: { comDados: boolean }) => useMarcarHomePronta(comDados),
      { initialProps: { comDados: false } },
    )
    expect(end).not.toHaveBeenCalled()

    await rerender({ comDados: true })
    await rerender({ comDados: false })
    await rerender({ comDados: true })
    expect(end).toHaveBeenCalledTimes(1)
    expect(startInactiveSpan).toHaveBeenCalledTimes(1)
  })

  it('sem DSN nenhum span é criado e a Home renderiza sem falhar', async () => {
    jest.replaceProperty(ambiente, 'sentryDsn', undefined)
    iniciarSpanAbertura()

    await renderHook(() => useMarcarHomePronta(true))
    expect(startInactiveSpan).not.toHaveBeenCalled()
  })

  it('em __DEV__, com o Sentry desligado, nenhum span é criado', () => {
    jest.replaceProperty(globais, '__DEV__', true)
    jest.replaceProperty(ambiente, 'sentryDsn', DSN)
    iniciarSpanAbertura()

    expect(startInactiveSpan).not.toHaveBeenCalled()
  })
})

describe('limparBreadcrumb', () => {
  it('remove Authorization e o corpo das requisições HTTP', () => {
    const breadcrumb = limparBreadcrumb({
      category: 'xhr',
      data: {
        method: 'POST',
        url: '/auth/login',
        status_code: 500,
        body: '{"senha":"x"}',
        response_body: '{}',
        headers: { Authorization: 'Bearer abc', Accept: 'application/json' },
      },
    })
    expect(breadcrumb.data).toEqual({
      method: 'POST',
      url: '/auth/login',
      status_code: 500,
      headers: { Accept: 'application/json' },
    })
  })

  it('fora de HTTP remove só Authorization', () => {
    const breadcrumb = limparBreadcrumb({
      category: 'navigation',
      data: { body: 'ok', authorization: 'Bearer abc' },
    })
    expect(breadcrumb.data).toEqual({ body: 'ok' })
  })
})

describe('limparEvento', () => {
  it('troca e-mails por [email] em message, extra, breadcrumbs e exceções', () => {
    const evento = limparEvento({
      type: undefined,
      message: 'falha para fulano@ufma.br',
      extra: { contato: { email: 'a@b.com' } },
      breadcrumbs: [{ message: 'login de ana@exemplo.com', data: { url: '/x?email=c@d.br' } }],
      exception: { values: [{ value: 'Usuário fulano@ufma.br não encontrado' }] },
    })

    expect(evento.message).toBe('falha para [email]')
    expect(evento.extra).toEqual({ contato: { email: '[email]' } })
    expect(evento.breadcrumbs).toEqual([{ message: 'login de [email]', data: { url: '[email]' } }])
    expect(evento.exception?.values?.[0]?.value).toBe('Usuário [email] não encontrado')
  })

  it('mantém só o id do usuário', () => {
    const evento = limparEvento({
      type: undefined,
      user: { id: 'u1', email: 'a@b.com', username: 'Ana' },
    })
    expect(evento.user).toEqual({ id: 'u1' })
  })
})

describe('acompanharUsuario', () => {
  const usuario = {
    id: 'u1',
    nome: 'Ana',
    email: 'ana@exemplo.com',
    fotoUrl: null,
    papel: Papel.ATLETA,
    atleticaId: 'a1',
  }

  it('envia só o id ao autenticar e limpa ao ficar anônimo', async () => {
    const parar = acompanharUsuario()
    await useSessao.getState().iniciarSessao({
      accessToken: 'a',
      refreshToken: 'r',
      accessTokenExpiraEm: new Date(Date.now() + 60_000).toISOString(),
      usuario,
    })
    expect(Sentry.setUser).toHaveBeenLastCalledWith({ id: 'u1' })

    await useSessao.getState().encerrarSessao({ motivo: 'LOGOUT' })
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null)
    parar()
  })
})
