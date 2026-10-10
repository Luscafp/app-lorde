import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { Papel, type AtleticaPublica, type RespostaSessao } from '@atletica/shared'
import { onlineManager } from '@tanstack/react-query'
import { act, fireEvent, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderRouter, screen } from 'expo-router/testing-library'
import { Alert, Text, View, type AlertButton } from 'react-native'
import * as rotaApp from '../app/(app)/_layout'
import LayoutAbas from '../app/(app)/(abas)/_layout'
import Inicio from '../app/(app)/(abas)/index'
import * as rotaPublica from '../app/(publico)/_layout'
import Login from '../app/(publico)/login'
import PaginaNaoEncontrada from '../app/+not-found'
import LayoutRaiz from '../app/_layout'
import { toast } from '@/components/ui/toast'
import { CHAVE_CACHE_ATLETICA } from '@/features/atletica/api'
import {
  BotaoSair,
  MENSAGEM_SESSAO_ENCERRADA,
  processarLogoutPendente,
  sair,
  TEMPO_LIMITE_LOGOUT_MS,
} from '@/features/auth'
import { CHAVE_DISPOSITIVO_ID } from '@/features/notificacoes/registro-push'
import { api } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { queryClient } from '@/infra/query/query-client'
import {
  adicionarLogoutPendente,
  CHAVE_LOGOUT_PENDENTE,
  listarLogoutPendente,
} from '@/infra/sessao/logout-pendente'
import { CHAVE_DADOS_SESSAO, CHAVE_REFRESH_TOKEN, useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))

function Perfil() {
  return (
    <View>
      <Text accessibilityRole="header">Perfil</Text>
      <BotaoSair />
    </View>
  )
}

const rotas = {
  _layout: LayoutRaiz,
  '+not-found': PaginaNaoEncontrada,
  '(publico)/_layout': rotaPublica,
  '(publico)/login': Login,
  '(app)/_layout': rotaApp,
  '(app)/(abas)/_layout': LayoutAbas,
  '(app)/(abas)/index': Inicio,
  '(app)/(abas)/perfil': Perfil,
}

const atletica: AtleticaPublica = {
  id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
  nome: 'Atlética Teste',
  sigla: 'AT',
  curso: null,
  logoUrl: null,
  corPrimaria: '#E11D48',
  corSecundaria: '#2563EB',
  contatoEmail: 'diretoria@exemplo.com',
  contatoInstagram: null,
  contatoWhatsapp: null,
}

const sessao: RespostaSessao = {
  accessToken: 'access',
  refreshToken: 'refresh',
  accessTokenExpiraEm: new Date(Date.now() + 15 * 60_000).toISOString(),
  usuario: {
    id: '0b0f5c0e-6a43-4c55-9d3a-0d7f8d6c4f11',
    nome: 'Ana',
    email: 'ana@exemplo.com',
    fotoUrl: null,
    papel: Papel.ATLETA,
    atleticaId: atletica.id,
  },
}

const ID_DISPOSITIVO = '3f0c6a9e-2b7d-4c1a-9e8f-5d4c3b2a1f0e'

type Resposta = { status: number; corpo?: unknown }
type Responder = (init?: RequestInit) => Promise<Response>

const itensSeguros = (SecureStore as unknown as { __itens: Map<string, string> }).__itens
const netInfo = NetInfo as unknown as { __emitir: (estado: object) => void }
const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>()
const respostas = new Map<string, Responder>()

function resposta({ status, corpo }: Resposta): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: () => Promise.resolve(corpo === undefined ? '' : JSON.stringify(corpo)),
  } as unknown as Response
}

const com =
  (dados: Resposta): Responder =>
  () =>
    Promise.resolve(resposta(dados))

/** Só termina quando o `AbortSignal` da requisição dispara. */
const semResposta: Responder = (init) =>
  new Promise((_, rejeitar) => {
    if (init?.signal?.aborted) rejeitar(new Error('Aborted'))
    init?.signal?.addEventListener('abort', () => rejeitar(new Error('Aborted')))
  })

const tokensEnviadosAoLogout = () =>
  fetchMock.mock.calls
    .filter(([url]) => url.endsWith('/auth/logout'))
    .map(([, init]) => (JSON.parse(init?.body as string) as { refreshToken: string }).refreshToken)

const ficarOnline = (online: boolean) =>
  act(() => netInfo.__emitir({ isConnected: online, isInternetReachable: online ? true : false }))

let botoesDoAlerta: AlertButton[] = []
const tocarNoAlerta = (texto: string) =>
  act(() => botoesDoAlerta.find((botao) => botao.text === texto)?.onPress?.())

async function abrirPerfil() {
  const rota = renderRouter(rotas, { initialUrl: '/perfil' })
  await rota
  await screen.findByRole('header', { name: 'Perfil' })
  return () => rota.getPathname()
}

async function confirmarSaida() {
  await fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }))
  await tocarNoAlerta('Sair')
}

beforeEach(async () => {
  jest.useRealTimers()
  fetchMock.mockReset()
  fetchMock.mockImplementation((url, init) => {
    if (url.endsWith('/atletica'))
      return Promise.resolve(resposta({ status: 200, corpo: atletica }))
    const responder = [...respostas].find(([caminho]) => url.endsWith(caminho))?.[1]
    return responder ? responder(init) : Promise.reject(new TypeError('Network request failed'))
  })
  global.fetch = fetchMock as unknown as typeof fetch
  respostas.clear()
  itensSeguros.clear()
  queryClient.clear()
  jest.mocked(toast.sucesso).mockClear()
  botoesDoAlerta = []
  jest.spyOn(Alert, 'alert').mockImplementation((_titulo, _mensagem, botoes) => {
    botoesDoAlerta = botoes ?? []
  })
  await AsyncStorage.clear()
  await AsyncStorage.setItem(CHAVE_CACHE_ATLETICA, JSON.stringify(atletica))
  netInfo.__emitir({ isConnected: true, isInternetReachable: true })
  onlineManager.setOnline(true)
  useSessao.setState({ status: 'carregando', usuario: null, accessToken: null, refreshToken: null })
  await useSessao.getState().iniciarSessao(sessao)
})

describe('BotaoSair', () => {
  it('mostra a confirmação e "Cancelar" não faz nada', async () => {
    const caminho = await abrirPerfil()

    await fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(Alert.alert).toHaveBeenCalledWith(
      'Sair da conta',
      'Deseja encerrar a sessão neste dispositivo?',
      expect.any(Array),
    )
    await tocarNoAlerta('Cancelar')

    expect(useSessao.getState().status).toBe('autenticado')
    expect(tokensEnviadosAoLogout()).toEqual([])
    expect(caminho()).toBe('/perfil')
  })

  it('online: revoga na API uma vez, limpa storage e cache, mostra o login e não grava pendente', async () => {
    respostas.set('/auth/logout', com({ status: 204 }))
    queryClient.setQueryData(chaves.eventos.todos(), [{ id: 1 }])
    const caminho = await abrirPerfil()

    await confirmarSaida()

    expect(await screen.findByRole('header', { name: 'Atlética Teste' })).toBeOnTheScreen()
    expect(caminho()).toBe('/login')
    expect(tokensEnviadosAoLogout()).toEqual(['refresh'])
    expect(itensSeguros.has(CHAVE_REFRESH_TOKEN)).toBe(false)
    expect(await AsyncStorage.getItem(CHAVE_DADOS_SESSAO)).toBeNull()
    expect(queryClient.getQueryData(chaves.eventos.todos())).toBeUndefined()
    expect(await listarLogoutPendente()).toEqual([])
    expect(toast.sucesso).toHaveBeenCalledWith(MENSAGEM_SESSAO_ENCERRADA)
  })

  it('online: remove o aparelho com o dispositivoId guardado antes de revogar a sessão', async () => {
    itensSeguros.set(CHAVE_DISPOSITIVO_ID, ID_DISPOSITIVO)
    respostas.set(`/me/dispositivos/${ID_DISPOSITIVO}`, com({ status: 204 }))
    respostas.set('/auth/logout', com({ status: 204 }))
    await abrirPerfil()

    await confirmarSaida()

    expect(await screen.findByRole('header', { name: 'Atlética Teste' })).toBeOnTheScreen()
    const chamadas = fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${url}`)
    const remocao = chamadas.findIndex(
      (chamada) =>
        chamada.startsWith('DELETE ') && chamada.endsWith(`/me/dispositivos/${ID_DISPOSITIVO}`),
    )
    expect(remocao).toBeGreaterThanOrEqual(0)
    expect(remocao).toBeLessThan(chamadas.findIndex((chamada) => chamada.endsWith('/auth/logout')))
    expect(itensSeguros.has(CHAVE_DISPOSITIVO_ID)).toBe(false)
  })

  it('offline: não chama DELETE /me/dispositivos, esquece o aparelho e segue o logout pendente', async () => {
    itensSeguros.set(CHAVE_DISPOSITIVO_ID, ID_DISPOSITIVO)
    await abrirPerfil()
    await ficarOnline(false)

    await confirmarSaida()

    expect(await screen.findByRole('header', { name: 'Atlética Teste' })).toBeOnTheScreen()
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/me/dispositivos'))).toBe(false)
    expect(itensSeguros.has(CHAVE_DISPOSITIVO_ID)).toBe(false)
    expect(await listarLogoutPendente()).toEqual(['refresh'])
  })

  it('offline: sai sem chamar a API, grava o pendente e o envia quando a conexão volta', async () => {
    const caminho = await abrirPerfil()
    await ficarOnline(false)

    await confirmarSaida()

    expect(await screen.findByRole('header', { name: 'Atlética Teste' })).toBeOnTheScreen()
    expect(caminho()).toBe('/login')
    expect(tokensEnviadosAoLogout()).toEqual([])
    expect(itensSeguros.has(CHAVE_REFRESH_TOKEN)).toBe(false)
    expect(await listarLogoutPendente()).toEqual(['refresh'])

    respostas.set('/auth/logout', com({ status: 204 }))
    await ficarOnline(true)

    await waitFor(() => expect(itensSeguros.has(CHAVE_LOGOUT_PENDENTE)).toBe(false))
    expect(tokensEnviadosAoLogout()).toEqual(['refresh'])
  })
})

describe('sair', () => {
  it('POST /auth/logout acima de 5 s: conclui o logout local e grava o pendente', async () => {
    jest.useFakeTimers()
    respostas.set('/auth/logout', semResposta)

    const saida = sair()
    await jest.advanceTimersByTimeAsync(TEMPO_LIMITE_LOGOUT_MS)
    await saida

    expect(tokensEnviadosAoLogout()).toEqual(['refresh'])
    expect(useSessao.getState().status).toBe('anonimo')
    expect(await listarLogoutPendente()).toEqual(['refresh'])
  })

  it('DELETE do aparelho e POST /auth/logout dividem o mesmo prazo de 5 s', async () => {
    jest.useFakeTimers()
    itensSeguros.set(CHAVE_DISPOSITIVO_ID, ID_DISPOSITIVO)
    respostas.set(`/me/dispositivos/${ID_DISPOSITIVO}`, semResposta)
    respostas.set('/auth/logout', semResposta)

    const saida = sair()
    await jest.advanceTimersByTimeAsync(TEMPO_LIMITE_LOGOUT_MS)
    await saida

    expect(useSessao.getState().status).toBe('anonimo')
    expect(itensSeguros.has(CHAVE_DISPOSITIVO_ID)).toBe(false)
    expect(await listarLogoutPendente()).toEqual(['refresh'])
  })

  it('5xx grava o pendente; 4xx não', async () => {
    respostas.set('/auth/logout', com({ status: 503 }))
    await sair()
    expect(await listarLogoutPendente()).toEqual(['refresh'])

    await useSessao.getState().iniciarSessao({ ...sessao, refreshToken: 'outro' })
    respostas.set('/auth/logout', com({ status: 400 }))
    await sair()
    expect(await listarLogoutPendente()).toEqual(['refresh'])
  })

  it('429 grava o pendente', async () => {
    respostas.set('/auth/logout', com({ status: 429, corpo: { code: 'RATE_LIMITED' } }))

    await sair()

    expect(await listarLogoutPendente()).toEqual(['refresh'])
  })

  it('falha do secure-store ao gravar o pendente não impede o logout local', async () => {
    onlineManager.setOnline(false)
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('keystore'))

    await sair()

    expect(useSessao.getState().status).toBe('anonimo')
    expect(toast.sucesso).toHaveBeenCalledWith(MENSAGEM_SESSAO_ENCERRADA)
  })

  it('refresh com 401 encerra a sessão sem gravar logoutPendente', async () => {
    useSessao.setState({ accessTokenExpiraEm: new Date(Date.now() - 1000).toISOString() })
    respostas.set('/auth/refresh', com({ status: 401, corpo: { code: 'NAO_AUTENTICADO' } }))

    await expect(api.get('/eventos')).rejects.toMatchObject({ code: 'SESSAO_ENCERRADA' })

    expect(useSessao.getState().status).toBe('anonimo')
    expect(tokensEnviadosAoLogout()).toEqual([])
    expect(await listarLogoutPendente()).toEqual([])
  })
})

describe('processarLogoutPendente', () => {
  it('envia cada token e remove só os que tiveram resposta', async () => {
    await adicionarLogoutPendente('r1')
    await adicionarLogoutPendente('r2')
    await adicionarLogoutPendente('r1')
    respostas.set('/auth/logout', (init) => {
      const { refreshToken } = JSON.parse(init?.body as string) as { refreshToken: string }
      return refreshToken === 'r1'
        ? Promise.resolve(resposta({ status: 204 }))
        : Promise.reject(new TypeError('Network request failed'))
    })

    await processarLogoutPendente()

    expect(tokensEnviadosAoLogout()).toEqual(['r1', 'r2'])
    expect(await listarLogoutPendente()).toEqual(['r2'])
  })

  it('falha de leitura do secure-store não apaga os pendentes', async () => {
    await adicionarLogoutPendente('r1')
    onlineManager.setOnline(false)
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('keystore'))

    await expect(adicionarLogoutPendente('r2')).rejects.toThrow('keystore')

    expect(await listarLogoutPendente()).toEqual(['r1'])
  })

  it('offline não chama a API', async () => {
    await adicionarLogoutPendente('r1')
    onlineManager.setOnline(false)

    await processarLogoutPendente()

    expect(tokensEnviadosAoLogout()).toEqual([])
    expect(await listarLogoutPendente()).toEqual(['r1'])
  })
})
