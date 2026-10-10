import * as Sentry from '@sentry/react-native'
import { waitFor } from '@testing-library/react-native'
import { Papel } from '@atletica/shared'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { features } from '@/config/features'
import {
  CHAVE_DISPOSITIVO_ID,
  CHAVE_PERMISSAO_PERGUNTADA,
  acompanharRegistroPush,
  estadoPermissao,
  iniciarNotificacoes,
  registrarSeConcedida,
  removerDispositivo,
  solicitarPermissaoERegistrar,
} from '@/features/notificacoes/registro-push'
import { ApiErro, CodigoLocal } from '@/infra/api/api-erro'
import { api } from '@/infra/api/cliente'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/infra/api/cliente', () => ({ api: { post: jest.fn(), delete: jest.fn() } }))
jest.mock('@/config/features', () => ({
  features: { notificacoes: true, avisosHabilitados: false },
}))
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'id-projeto-eas' } } } },
}))

const ID_PROJETO = 'id-projeto-eas'

type MockNotificacoes = typeof Notifications & {
  permissao: (status: string, canAskAgain?: boolean) => Notifications.NotificationPermissionsStatus
  __trocarToken: (token: string) => void
  __reiniciar: () => void
}

const notificacoes = Notifications as MockNotificacoes
const itensSeguros = (SecureStore as unknown as { __itens: Map<string, string> }).__itens
const flags = features as { notificacoes: boolean }
const post = jest.mocked(api.post)
const remover = jest.mocked(api.delete)

const DISPOSITIVO = {
  id: '3f0c6a9e-2b7d-4c1a-9e8f-5d4c3b2a1f0e',
  ultimoUsoEm: '2026-10-01T12:00:00.000Z',
}
const TOKEN = 'ExponentPushToken[token-teste]'

const usuario = {
  id: '0b0f5c0e-6a43-4c55-9d3a-0d7f8d6c4f11',
  nome: 'Ana',
  email: 'ana@exemplo.com',
  fotoUrl: null,
  papel: Papel.ATLETA,
  atleticaId: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
}

function concederPermissao(status: 'granted' | 'denied' | 'undetermined' = 'granted') {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(notificacoes.permissao(status))
}

function definirSessao(status: 'autenticado' | 'anonimo') {
  useSessao.setState({ status, usuario: status === 'autenticado' ? usuario : null })
}

const corpoRegistrado = (token = TOKEN) => [
  '/me/dispositivos',
  { tokenPush: token, plataforma: 'android' },
]

const esperarRegistros = (vezes: number) => waitFor(() => expect(post).toHaveBeenCalledTimes(vezes))

let pararAcompanhamento: (() => void) | undefined

beforeEach(() => {
  jest.clearAllMocks()
  notificacoes.__reiniciar()
  itensSeguros.clear()
  flags.notificacoes = true
  concederPermissao('denied')
  post.mockResolvedValue(DISPOSITIVO)
  remover.mockResolvedValue(undefined)
  definirSessao('anonimo')
})

afterEach(() => {
  pararAcompanhamento?.()
  pararAcompanhamento = undefined
})

describe('registro do dispositivo', () => {
  it('com permissão: obtém o token com o projectId da config, registra e guarda o id', async () => {
    concederPermissao()

    await registrarSeConcedida()

    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: ID_PROJETO })
    expect(post).toHaveBeenCalledWith(...corpoRegistrado())
    expect(itensSeguros.get(CHAVE_DISPOSITIVO_ID)).toBe(DISPOSITIVO.id)
  })

  it.each(['denied', 'undetermined'] as const)('permissão %s: não registra', async (status) => {
    concederPermissao(status)

    await registrarSeConcedida()

    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })

  it('erro da API é silencioso, vai ao Sentry e não guarda o id', async () => {
    concederPermissao()
    const erro = new Error('503')
    post.mockRejectedValue(erro)

    await expect(registrarSeConcedida()).resolves.toBeUndefined()

    expect(Sentry.captureException).toHaveBeenCalledWith(erro)
    expect(itensSeguros.has(CHAVE_DISPOSITIVO_ID)).toBe(false)
  })

  it.each([
    new ApiErro({ status: 0, code: CodigoLocal.SEM_CONEXAO, message: 'Sem conexão' }),
    new ApiErro({ status: 400, code: 'VALIDATION_ERROR', message: 'Inválido' }),
  ])('ApiErro $status não vai ao Sentry', async (erro) => {
    concederPermissao()
    post.mockRejectedValue(erro)

    await registrarSeConcedida()

    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('ApiErro 5xx vai ao Sentry', async () => {
    concederPermissao()
    const erro = new ApiErro({ status: 503, code: 'INTERNAL_ERROR', message: 'Indisponível' })
    post.mockRejectedValue(erro)

    await registrarSeConcedida()

    expect(Sentry.captureException).toHaveBeenCalledWith(erro)
  })
})

describe('solicitarPermissaoERegistrar', () => {
  it('concedida: marca como perguntada e registra', async () => {
    jest.mocked(Notifications.requestPermissionsAsync).mockImplementationOnce(() => {
      concederPermissao()
      return Promise.resolve(notificacoes.permissao('granted'))
    })

    await solicitarPermissaoERegistrar()

    expect(itensSeguros.get(CHAVE_PERMISSAO_PERGUNTADA)).toBe('true')
    expect(post).toHaveBeenCalledWith(...corpoRegistrado())
  })

  it('negada: marca como perguntada e não registra', async () => {
    await solicitarPermissaoERegistrar()

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1)
    expect(itensSeguros.get(CHAVE_PERMISSAO_PERGUNTADA)).toBe('true')
    expect(post).not.toHaveBeenCalled()
  })
})

describe('estadoPermissao', () => {
  it.each([
    ['granted', 'concedida'],
    ['denied', 'negada'],
    ['undetermined', 'nao-perguntada'],
  ] as const)('%s → %s', async (status, permissao) => {
    concederPermissao(status)
    expect(await estadoPermissao()).toEqual({ permissao, registrado: false })
  })

  it('registrado quando há dispositivoId guardado', async () => {
    concederPermissao()
    itensSeguros.set(CHAVE_DISPOSITIVO_ID, DISPOSITIVO.id)
    expect(await estadoPermissao()).toEqual({ permissao: 'concedida', registrado: true })
  })
})

describe('acompanharRegistroPush', () => {
  it('re-registra na abertura autenticada', async () => {
    concederPermissao()
    definirSessao('autenticado')

    pararAcompanhamento = acompanharRegistroPush()

    await esperarRegistros(1)
  })

  it('registra ao entrar e de novo quando o token muda', async () => {
    concederPermissao()
    pararAcompanhamento = acompanharRegistroPush()
    expect(post).not.toHaveBeenCalled()

    definirSessao('autenticado')
    await esperarRegistros(1)

    jest
      .mocked(Notifications.getExpoPushTokenAsync)
      .mockResolvedValue({ type: 'expo', data: 'ExponentPushToken[novo]' })
    notificacoes.__trocarToken('fcm-novo')

    await esperarRegistros(2)
    expect(post).toHaveBeenLastCalledWith(...corpoRegistrado('ExponentPushToken[novo]'))
  })

  it('token novo sem sessão não chama a API', async () => {
    concederPermissao()
    pararAcompanhamento = acompanharRegistroPush()

    notificacoes.__trocarToken('fcm-novo')
    await Promise.resolve()

    expect(post).not.toHaveBeenCalled()
  })
})

describe('removerDispositivo', () => {
  it('chama DELETE com o id guardado e o limpa', async () => {
    itensSeguros.set(CHAVE_DISPOSITIVO_ID, DISPOSITIVO.id)

    await removerDispositivo()

    expect(remover).toHaveBeenCalledWith(`/me/dispositivos/${DISPOSITIVO.id}`, {
      sinal: undefined,
    })
    expect(itensSeguros.has(CHAVE_DISPOSITIVO_ID)).toBe(false)
  })

  it('limpa o id mesmo quando a API falha', async () => {
    itensSeguros.set(CHAVE_DISPOSITIVO_ID, DISPOSITIVO.id)
    remover.mockRejectedValue(new Error('500'))

    await expect(removerDispositivo()).rejects.toThrow('500')

    expect(itensSeguros.has(CHAVE_DISPOSITIVO_ID)).toBe(false)
  })

  it('sem id guardado não chama a API', async () => {
    await removerDispositivo()
    expect(remover).not.toHaveBeenCalled()
  })
})

describe('iniciarNotificacoes', () => {
  it('liga o canal "padrao" com importância alta e o banner com som em primeiro plano', async () => {
    iniciarNotificacoes()

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('padrao', {
      name: 'Notificações',
      importance: Notifications.AndroidImportance.HIGH,
    })
    const [manipulador] = jest.mocked(Notifications.setNotificationHandler).mock.calls[0] ?? []
    const notificacao = {} as Notifications.Notification
    await expect(manipulador?.handleNotification(notificacao)).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    })
  })

  it('flag desligada: nenhuma API de push é chamada', () => {
    flags.notificacoes = false

    iniciarNotificacoes()

    expect(Notifications.setNotificationHandler).not.toHaveBeenCalled()
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled()
    expect(Notifications.addPushTokenListener).not.toHaveBeenCalled()
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled()
  })
})
