import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { Papel, type AtleticaPublica, type RespostaSessao } from '@atletica/shared'
import { onlineManager } from '@tanstack/react-query'
import { act, fireEvent, waitFor } from '@testing-library/react-native'
import * as Notifications from 'expo-notifications'
import { useLocalSearchParams } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { renderRouter, screen } from 'expo-router/testing-library'
import { Text } from 'react-native'
import * as rotaApp from '../app/(app)/_layout'
import AtivarNotificacoes from '../app/(app)/ativar-notificacoes'
import * as rotaPublica from '../app/(publico)/_layout'
import LayoutRaiz from '../app/_layout'
import { CHAVE_CACHE_ATLETICA } from '@/features/atletica/api'
import {
  CHAVE_DISPOSITIVO_ID,
  CHAVE_PERMISSAO_PERGUNTADA,
} from '@/features/notificacoes/registro-push'
import { queryClient } from '@/infra/query/query-client'
import { useSessao } from '@/infra/sessao/store'

type MockNotificacoes = typeof Notifications & {
  permissao: (status: string) => Notifications.NotificationPermissionsStatus
  resposta: (url: unknown, identificador?: string) => Notifications.NotificationResponse
  __abrirPorNotificacao: (resposta: Notifications.NotificationResponse) => void
  __tocarNotificacao: (resposta: Notifications.NotificationResponse) => void
  __reiniciar: () => void
}

const notificacoes = Notifications as MockNotificacoes
const itensSeguros = (SecureStore as unknown as { __itens: Map<string, string> }).__itens
const netInfo = NetInfo as unknown as { __emitir: (estado: object) => void }

const ID_NOTICIA = '9b2f4c1e-7d3a-4e5b-8c6d-1a2b3c4d5e6f'
const DISPOSITIVO = {
  id: '3f0c6a9e-2b7d-4c1a-9e8f-5d4c3b2a1f0e',
  ultimoUsoEm: '2026-10-01T12:00:00.000Z',
}

function Noticia() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <Text accessibilityRole="header">{`Notícia ${id}`}</Text>
}

const rotas = {
  _layout: LayoutRaiz,
  '(publico)/_layout': rotaPublica,
  '(publico)/login': () => <Text accessibilityRole="header">Entrar</Text>,
  '(app)/_layout': rotaApp,
  '(app)/(abas)/index': () => <Text accessibilityRole="header">Início</Text>,
  '(app)/noticias/[id]': Noticia,
  '(app)/ativar-notificacoes': AtivarNotificacoes,
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

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>()

function resposta(status: number, corpo?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: () => Promise.resolve(corpo === undefined ? '' : JSON.stringify(corpo)),
  } as unknown as Response
}

const registros = () =>
  fetchMock.mock.calls
    .filter(([url, init]) => url.endsWith('/me/dispositivos') && init?.method === 'POST')
    .map(([, init]) => JSON.parse(init?.body as string) as unknown)

function permissaoDoSistema(status: 'granted' | 'denied' | 'undetermined') {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(notificacoes.permissao(status))
}

/** Abertura a frio: a sessão gravada é restaurada pelo layout raiz. */
async function abrirApp(initialUrl = '/') {
  const rota = renderRouter(rotas, { initialUrl })
  await rota
  return () => rota.getPathname()
}

beforeEach(async () => {
  jest.clearAllMocks()
  notificacoes.__reiniciar()
  permissaoDoSistema('denied')
  fetchMock.mockReset()
  fetchMock.mockImplementation((url) => {
    if (url.endsWith('/atletica')) return Promise.resolve(resposta(200, atletica))
    if (url.endsWith('/me/dispositivos')) return Promise.resolve(resposta(200, DISPOSITIVO))
    return Promise.reject(new TypeError('Network request failed'))
  })
  global.fetch = fetchMock as unknown as typeof fetch
  itensSeguros.clear()
  queryClient.clear()
  await AsyncStorage.clear()
  await AsyncStorage.setItem(CHAVE_CACHE_ATLETICA, JSON.stringify(atletica))
  netInfo.__emitir({ isConnected: true, isInternetReachable: true })
  onlineManager.setOnline(true)
  await useSessao.getState().iniciarSessao(sessao)
  useSessao.setState({ status: 'carregando' })
})

describe('pré-permissão no primeiro login (épico #36 critérios 1 e 2)', () => {
  it('"Permitir" concedido: pede a permissão, registra o aparelho e volta ao Início', async () => {
    permissaoDoSistema('undetermined')
    jest.mocked(Notifications.requestPermissionsAsync).mockImplementationOnce(() => {
      permissaoDoSistema('granted')
      return Promise.resolve(notificacoes.permissao('granted'))
    })
    const caminho = await abrirApp()

    expect(await screen.findByRole('header', { name: 'Ativar notificações' })).toBeOnTheScreen()
    expect(caminho()).toBe('/ativar-notificacoes')
    await fireEvent.press(screen.getByRole('button', { name: 'Permitir' }))

    expect(await screen.findByRole('header', { name: 'Início' })).toBeOnTheScreen()
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(registros()).toEqual([
        { tokenPush: 'ExponentPushToken[token-teste]', plataforma: 'android' },
      ]),
    )
    expect(itensSeguros.get(CHAVE_DISPOSITIVO_ID)).toBe(DISPOSITIVO.id)
  })

  it('"Agora não": não pede a permissão, não registra e guarda que já perguntou', async () => {
    permissaoDoSistema('undetermined')
    const caminho = await abrirApp()

    await fireEvent.press(await screen.findByRole('button', { name: 'Agora não' }))

    expect(await screen.findByRole('header', { name: 'Início' })).toBeOnTheScreen()
    expect(caminho()).toBe('/')
    expect(itensSeguros.get(CHAVE_PERMISSAO_PERGUNTADA)).toBe('true')
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled()
    expect(registros()).toEqual([])
  })

  it('já perguntado no aparelho: não abre a pré-permissão de novo', async () => {
    permissaoDoSistema('undetermined')
    itensSeguros.set(CHAVE_PERMISSAO_PERGUNTADA, 'true')
    const caminho = await abrirApp()

    expect(await screen.findByRole('header', { name: 'Início' })).toBeOnTheScreen()
    await waitFor(() => expect(Notifications.getPermissionsAsync).toHaveBeenCalled())

    expect(caminho()).toBe('/')
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled()
    expect(registros()).toEqual([])
  })

  it('negada no sistema: entra sem perguntar e nenhum dispositivo é registrado', async () => {
    const caminho = await abrirApp()

    expect(await screen.findByRole('header', { name: 'Início' })).toBeOnTheScreen()
    await waitFor(() => expect(itensSeguros.get(CHAVE_PERMISSAO_PERGUNTADA)).toBe('true'))

    expect(caminho()).toBe('/')
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled()
    expect(registros()).toEqual([])
  })

  it('já concedida: re-registra o aparelho a cada abertura autenticada', async () => {
    permissaoDoSistema('granted')
    itensSeguros.set(CHAVE_PERMISSAO_PERGUNTADA, 'true')

    await abrirApp()

    expect(await screen.findByRole('header', { name: 'Início' })).toBeOnTheScreen()
    await waitFor(() => expect(registros()).toHaveLength(1))
  })
})

describe('deep link da notificação', () => {
  it('app fechado: depois de restaurar a sessão abre a notícia (critério 12)', async () => {
    notificacoes.__abrirPorNotificacao(notificacoes.resposta(`/noticias/${ID_NOTICIA}`))

    const caminho = await abrirApp()

    expect(await screen.findByRole('header', { name: `Notícia ${ID_NOTICIA}` })).toBeOnTheScreen()
    expect(caminho()).toBe(`/noticias/${ID_NOTICIA}`)
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled()
  })

  it('app aberto: o toque navega uma única vez para a URL permitida', async () => {
    const caminho = await abrirApp()
    await screen.findByRole('header', { name: 'Início' })

    await act(() =>
      notificacoes.__tocarNotificacao(notificacoes.resposta(`/noticias/${ID_NOTICIA}`)),
    )

    expect(await screen.findByRole('header', { name: `Notícia ${ID_NOTICIA}` })).toBeOnTheScreen()
    expect(caminho()).toBe(`/noticias/${ID_NOTICIA}`)
  })

  it.each([
    'https://exemplo.com/phishing',
    '/painel/usuarios',
    `/noticias/${ID_NOTICIA}/../../painel`,
    42,
    undefined,
  ])('URL fora da lista permitida (%p) abre a Home (critério 13)', async (url) => {
    const caminho = await abrirApp(`/noticias/${ID_NOTICIA}`)
    await screen.findByRole('header', { name: `Notícia ${ID_NOTICIA}` })

    await act(() => notificacoes.__tocarNotificacao(notificacoes.resposta(url)))

    expect(await screen.findByRole('header', { name: 'Início' })).toBeOnTheScreen()
    expect(caminho()).toBe('/')
  })

  it('sem sessão: vai ao login e, depois de entrar, abre a URL da notificação', async () => {
    await useSessao.getState().encerrarSessao({ motivo: 'LOGOUT' })
    useSessao.setState({ status: 'carregando' })
    notificacoes.__abrirPorNotificacao(notificacoes.resposta(`/noticias/${ID_NOTICIA}`))
    const caminho = await abrirApp()

    expect(await screen.findByRole('header', { name: 'Entrar' })).toBeOnTheScreen()
    expect(caminho()).toBe('/login')

    await act(() => useSessao.getState().iniciarSessao(sessao))

    expect(await screen.findByRole('header', { name: `Notícia ${ID_NOTICIA}` })).toBeOnTheScreen()
    expect(caminho()).toBe(`/noticias/${ID_NOTICIA}`)
  })
})
