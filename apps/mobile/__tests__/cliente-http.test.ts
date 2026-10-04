import { Papel, type RespostaSessao } from '@atletica/shared'
import * as SecureStore from 'expo-secure-store'
import { toast } from '@/components/ui/toast'
import { api, ApiErro, definirRegistrador } from '@/infra/api/cliente'
import { MENSAGEM_CONTA_DESATIVADA, MENSAGEM_SESSAO_EXPIRADA } from '@/infra/api/renovar-sessao'
import { CHAVE_ACCESS_TOKEN, CHAVE_REFRESH_TOKEN, useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))

const API = 'http://localhost:3000/api/v1'
const itensSeguros = (SecureStore as unknown as { __itens: Map<string, string> }).__itens
const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>()
const registrador = jest.fn()

const usuario = {
  id: '0b0f5c0e-6a43-4c55-9d3a-0d7f8d6c4f11',
  nome: 'Ana',
  email: 'ana@exemplo.com',
  fotoUrl: null,
  papel: Papel.ATLETA,
  atleticaId: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
}

const daquiA = (ms: number) => new Date(Date.now() + ms).toISOString()

const sessaoRenovada: RespostaSessao = {
  accessToken: 'novo',
  refreshToken: 'r2',
  accessTokenExpiraEm: daquiA(15 * 60_000),
  usuario: { ...usuario, papel: Papel.DIRETOR },
}

function resposta(status: number, corpo?: unknown, requestId?: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (nome: string) => (nome === 'x-request-id' ? (requestId ?? null) : null) },
    text: () => Promise.resolve(corpo === undefined ? '' : JSON.stringify(corpo)),
  } as unknown as Response
}

const erro = (status: number, code: string, message = 'Erro.', details: unknown[] = []) =>
  resposta(status, { statusCode: status, code, message, details })

type Chamada = { url: string; init: RequestInit; token: string | undefined }

function chamadas(): Chamada[] {
  return fetchMock.mock.calls.map(([url, init = {}]) => ({
    url: url,
    init,
    token: (init.headers as Record<string, string>).Authorization?.replace('Bearer ', ''),
  }))
}

const chamadasDeRefresh = () => chamadas().filter((c) => c.url === `${API}/auth/refresh`)

/** Rotas fora de /auth/refresh: 401 com o token velho, 200 com o novo. */
function rotearCom(refresh: () => Promise<Response>) {
  fetchMock.mockImplementation((url, init) => {
    if (url.endsWith('/auth/refresh')) return refresh()
    const token = (init?.headers as Record<string, string>).Authorization
    return Promise.resolve(
      token === 'Bearer novo' ? resposta(200, { url }) : erro(401, 'TOKEN_EXPIRED'),
    )
  })
}

async function capturar(promessa: Promise<unknown>): Promise<ApiErro> {
  try {
    await promessa
  } catch (e) {
    if (e instanceof ApiErro) return e
    throw e
  }
  throw new Error('a requisição deveria falhar')
}

beforeEach(async () => {
  global.fetch = fetchMock as unknown as typeof fetch
  fetchMock.mockReset()
  jest.mocked(toast.erro).mockClear()
  registrador.mockClear()
  definirRegistrador(registrador)
  itensSeguros.clear()
  await useSessao.getState().iniciarSessao({
    accessToken: 'velho',
    refreshToken: 'r1',
    accessTokenExpiraEm: daquiA(10 * 60_000),
    usuario,
  })
  fetchMock.mockClear()
})

afterEach(() => jest.useRealTimers())

describe('requisição', () => {
  it('envia JSON, Authorization, X-Request-Id e X-App-Version para a API', async () => {
    fetchMock.mockResolvedValue(resposta(201, { id: '1' }))

    const dados = await api.post(
      '/eventos',
      { titulo: 'Treino' },
      { consulta: { a: 1, b: undefined } },
    )

    expect(dados).toEqual({ id: '1' })
    const [{ url, init }] = chamadas() as [Chamada]
    expect(url).toBe(`${API}/eventos?a=1`)
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ titulo: 'Treino' }))
    const cabecalhos = init.headers as Record<string, string>
    expect(cabecalhos).toMatchObject({
      Authorization: 'Bearer velho',
      'Content-Type': 'application/json',
      'X-App-Version': '0.0.0',
    })
    expect(cabecalhos['X-Request-Id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/)
  })

  it('não envia Authorization para outro domínio', async () => {
    fetchMock.mockResolvedValue(resposta(200))

    await api.put('https://r2.exemplo.com/upload?assinatura=x', 'binario')

    expect(chamadas()[0]?.init.headers).not.toHaveProperty('Authorization')
  })

  it('204 sem corpo devolve undefined', async () => {
    fetchMock.mockResolvedValue(resposta(204))
    await expect(api.delete('/eventos/1')).resolves.toBeUndefined()
  })

  it('converte o corpo de erro em ApiErro', async () => {
    fetchMock.mockResolvedValue(
      resposta(
        400,
        {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos.',
          details: [{ field: 'tags.0', message: 'Obrigatório' }],
        },
        'req-123',
      ),
    )

    const e = await capturar(api.post('/painel/noticias', {}))

    expect(e).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos.',
      details: [{ field: 'tags.0', message: 'Obrigatório' }],
      requestId: 'req-123',
    })
  })

  it('5xx sem corpo JSON vira INTERNAL_ERROR com mensagem genérica', async () => {
    fetchMock.mockResolvedValue({ ...resposta(502), text: () => Promise.resolve('<html>') })

    const e = await capturar(api.get('/eventos'))

    expect(e).toMatchObject({ status: 502, code: 'INTERNAL_ERROR', details: [] })
    expect(e.message).toBe('Ocorreu um erro inesperado. Tente novamente.')
  })

  it('falha de rede vira SEM_CONEXAO', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))
    expect(await capturar(api.get('/eventos'))).toMatchObject({ status: 0, code: 'SEM_CONEXAO' })
  })

  it('depois de 15 s vira TEMPO_ESGOTADO', async () => {
    jest.useFakeTimers()
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolver, rejeitar) =>
          init?.signal?.addEventListener('abort', () => rejeitar(new Error('abortada'))),
        ),
    )

    const pendente = capturar(api.get('/eventos'))
    await jest.advanceTimersByTimeAsync(15_000)

    expect(await pendente).toMatchObject({ status: 0, code: 'TEMPO_ESGOTADO' })
  })
})

describe('renovação da sessão', () => {
  it('três 401 simultâneos chamam /auth/refresh uma única vez e refazem as três', async () => {
    let liberar: () => void = () => undefined
    rotearCom(
      () => new Promise((resolver) => (liberar = () => resolver(resposta(200, sessaoRenovada)))),
    )

    const pendentes = Promise.all([api.get('/eventos'), api.get('/times'), api.get('/me')])
    await new Promise((resolver) => setImmediate(resolver))
    liberar()

    await expect(pendentes).resolves.toHaveLength(3)
    expect(chamadasDeRefresh()).toHaveLength(1)
    expect(chamadasDeRefresh()[0]?.init.body).toBe(JSON.stringify({ refreshToken: 'r1' }))
    expect(chamadas().filter((c) => c.token === 'novo')).toHaveLength(3)
  })

  it('refresh 200 grava os tokens antes de refazer e atualiza o usuário', async () => {
    const tokenGravadoNaRepeticao: (string | undefined)[] = []
    fetchMock.mockImplementation((url, init) => {
      if (url.endsWith('/auth/refresh')) return Promise.resolve(resposta(200, sessaoRenovada))
      const token = (init?.headers as Record<string, string>).Authorization
      if (token !== 'Bearer novo') return Promise.resolve(erro(401, 'TOKEN_EXPIRED'))
      tokenGravadoNaRepeticao.push(itensSeguros.get(CHAVE_ACCESS_TOKEN))
      return Promise.resolve(resposta(200, {}))
    })

    await api.get('/eventos')

    expect(tokenGravadoNaRepeticao).toEqual(['novo'])
    expect(itensSeguros.get(CHAVE_REFRESH_TOKEN)).toBe('r2')
    expect(useSessao.getState()).toMatchObject({
      status: 'autenticado',
      accessToken: 'novo',
      refreshToken: 'r2',
      accessTokenExpiraEm: sessaoRenovada.accessTokenExpiraEm,
      usuario: { papel: Papel.DIRETOR },
    })
  })

  it.each([
    ['REFRESH_INVALIDO', MENSAGEM_SESSAO_EXPIRADA],
    ['SESSAO_REVOGADA', MENSAGEM_SESSAO_EXPIRADA],
    ['REFRESH_JA_ROTACIONADO', MENSAGEM_SESSAO_EXPIRADA],
    ['CONTA_DESATIVADA', MENSAGEM_CONTA_DESATIVADA],
  ])('refresh 401 %s encerra a sessão com a mensagem certa', async (code, mensagem) => {
    rotearCom(() => Promise.resolve(erro(401, code)))

    const e = await capturar(api.get('/eventos'))

    expect(e).toMatchObject({ code: 'SESSAO_ENCERRADA', message: mensagem })
    expect(toast.erro).toHaveBeenCalledWith(mensagem)
    expect(useSessao.getState()).toMatchObject({ status: 'anonimo', refreshToken: null })
    expect(itensSeguros.size).toBe(0)
  })

  it('401 CONTA_DESATIVADA na rota e no refresh encerra com a mensagem de conta desativada', async () => {
    fetchMock.mockImplementation((url) => Promise.resolve(erro(401, 'CONTA_DESATIVADA', url)))

    await capturar(api.get('/eventos'))

    expect(chamadasDeRefresh()).toHaveLength(1)
    expect(toast.erro).toHaveBeenCalledWith(MENSAGEM_CONTA_DESATIVADA)
    expect(useSessao.getState().status).toBe('anonimo')
  })

  it.each([
    ['rede', () => Promise.reject(new TypeError('Network request failed')), 'SEM_CONEXAO'],
    [
      '503',
      () => Promise.resolve(erro(503, 'ARMAZENAMENTO_INDISPONIVEL')),
      'ARMAZENAMENTO_INDISPONIVEL',
    ],
    ['500', () => Promise.resolve(erro(500, 'INTERNAL_ERROR')), 'INTERNAL_ERROR'],
  ])('refresh com falha de %s mantém a sessão', async (_caso, refresh, code) => {
    rotearCom(refresh)

    const e = await capturar(api.get('/eventos'))

    expect(e.code).toBe(code)
    expect(toast.erro).not.toHaveBeenCalled()
    expect(useSessao.getState()).toMatchObject({ status: 'autenticado', refreshToken: 'r1' })
    expect(itensSeguros.get(CHAVE_REFRESH_TOKEN)).toBe('r1')
  })

  it('refresh com timeout mantém a sessão', async () => {
    jest.useFakeTimers()
    fetchMock.mockImplementation((url, init) => {
      if (!url.endsWith('/auth/refresh')) return Promise.resolve(erro(401, 'TOKEN_EXPIRED'))
      return new Promise((_resolver, rejeitar) =>
        init?.signal?.addEventListener('abort', () => rejeitar(new Error('abortada'))),
      )
    })

    const pendente = capturar(api.get('/eventos'))
    await jest.advanceTimersByTimeAsync(15_000)

    expect((await pendente).code).toBe('TEMPO_ESGOTADO')
    expect(useSessao.getState().status).toBe('autenticado')
  })

  it('refaz uma única vez: o segundo 401 falha sem novo refresh, sem logout e é registrado', async () => {
    fetchMock.mockImplementation((url) =>
      Promise.resolve(
        url.endsWith('/auth/refresh')
          ? resposta(200, sessaoRenovada)
          : erro(401, 'UNAUTHENTICATED', 'Não autenticado.'),
      ),
    )

    const e = await capturar(api.get('/eventos'))

    expect(e).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
    expect(chamadasDeRefresh()).toHaveLength(1)
    expect(chamadas()).toHaveLength(3)
    expect(useSessao.getState().status).toBe('autenticado')
    expect(registrador).toHaveBeenCalledWith(
      '401 depois da renovação da sessão',
      expect.objectContaining({ caminho: '/eventos', code: 'UNAUTHENTICATED' }),
    )
  })

  it('400 SENHA_INCORRETA não dispara refresh', async () => {
    fetchMock.mockResolvedValue(erro(400, 'SENHA_INCORRETA', 'Senha incorreta.'))

    const e = await capturar(api.put('/me/senha', { senhaAtual: 'x', novaSenha: 'y' }))

    expect(e.code).toBe('SENHA_INCORRETA')
    expect(chamadasDeRefresh()).toHaveLength(0)
    expect(useSessao.getState().status).toBe('autenticado')
  })

  it.each(['/auth/login', `${API}/auth/login`])(
    '401 de %s vai direto para a tela, sem refresh',
    async (caminho) => {
      fetchMock.mockResolvedValue(erro(401, 'CREDENCIAIS_INVALIDAS'))

      const e = await capturar(api.post(caminho, { email: 'a', senha: 'b' }))

      expect(e.code).toBe('CREDENCIAIS_INVALIDAS')
      expect(chamadas()).toHaveLength(1)
      expect(useSessao.getState().status).toBe('autenticado')
    },
  )

  it('sem sessão, 401 não dispara refresh', async () => {
    await useSessao.getState().encerrarSessao({ motivo: 'LOGOUT' })
    fetchMock.mockResolvedValue(erro(401, 'UNAUTHENTICATED'))

    await capturar(api.get('/eventos'))

    expect(chamadas()).toHaveLength(1)
    expect(chamadas()[0]?.token).toBeUndefined()
  })

  it('renova antes de enviar quando o access token vence em menos de 30 s', async () => {
    useSessao.setState({ accessTokenExpiraEm: daquiA(20_000) })
    rotearCom(() => Promise.resolve(resposta(200, sessaoRenovada)))

    await api.get('/eventos')

    expect(chamadas().map((c) => [c.url, c.token])).toEqual([
      [`${API}/auth/refresh`, undefined],
      [`${API}/eventos`, 'novo'],
    ])
  })

  it('renovação proativa sem rede ainda tenta a requisição com o token atual', async () => {
    useSessao.setState({ accessTokenExpiraEm: daquiA(20_000) })
    fetchMock.mockImplementation((url) =>
      url.endsWith('/auth/refresh')
        ? Promise.reject(new TypeError('Network request failed'))
        : Promise.resolve(resposta(200, { ok: true })),
    )

    await expect(api.get('/eventos')).resolves.toEqual({ ok: true })
    expect(chamadas().at(-1)?.token).toBe('velho')
  })
})
