import type {
  NotificationPermissionsStatus,
  NotificationResponse,
  PushTokenListener,
} from 'expo-notifications'

type OuvinteResposta = (resposta: NotificationResponse) => void

const ouvintesResposta = new Set<OuvinteResposta>()
const ouvintesToken = new Set<PushTokenListener>()
let ultimaResposta: NotificationResponse | null = null

export const DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT'
export const AndroidImportance = { HIGH: 5 } as const
export const PermissionStatus = {
  GRANTED: 'granted',
  UNDETERMINED: 'undetermined',
  DENIED: 'denied',
} as const

export function permissao(
  status: 'granted' | 'denied' | 'undetermined',
  canAskAgain = status !== 'denied',
): NotificationPermissionsStatus {
  return {
    status,
    granted: status === 'granted',
    canAskAgain,
    expires: 'never',
  } as NotificationPermissionsStatus
}

export const getPermissionsAsync = jest.fn(() => Promise.resolve(permissao('denied')))
export const requestPermissionsAsync = jest.fn(() => Promise.resolve(permissao('denied')))
let tokenDispositivo = 'fcm-teste'

function avisarOuvintesToken(): void {
  for (const ouvinte of ouvintesToken) ouvinte({ type: 'android', data: tokenDispositivo })
}

/** Como no Android: cada busca também avisa os ouvintes, mesmo sem o token mudar. */
export const getDevicePushTokenAsync = jest.fn(() => {
  setTimeout(avisarOuvintesToken, 0)
  return Promise.resolve({ type: 'android', data: tokenDispositivo })
})
export const getExpoPushTokenAsync = jest.fn(async (opcoes: { devicePushToken?: unknown } = {}) => {
  if (!opcoes.devicePushToken) await getDevicePushTokenAsync()
  return { type: 'expo', data: 'ExponentPushToken[token-teste]' }
})
export const setNotificationHandler = jest.fn()
export const setNotificationChannelAsync = jest.fn(() => Promise.resolve(null))
export const clearLastNotificationResponse = jest.fn(() => {
  ultimaResposta = null
})

export const addNotificationResponseReceivedListener = jest.fn((ouvinte: OuvinteResposta) => {
  ouvintesResposta.add(ouvinte)
  return { remove: () => ouvintesResposta.delete(ouvinte) }
})

export const addPushTokenListener = jest.fn((ouvinte: PushTokenListener) => {
  ouvintesToken.add(ouvinte)
  return { remove: () => ouvintesToken.delete(ouvinte) }
})

export const useLastNotificationResponse = jest.fn(() => ultimaResposta)

export function resposta(url: unknown, identificador = 'notificacao-1'): NotificationResponse {
  return {
    actionIdentifier: DEFAULT_ACTION_IDENTIFIER,
    notification: {
      date: Date.now(),
      request: { identifier: identificador, content: { data: { url } }, trigger: null },
    },
  } as unknown as NotificationResponse
}

/** Notificação tocada com o app fechado: o app abre com ela como última resposta. */
export function __abrirPorNotificacao(valor: NotificationResponse): void {
  ultimaResposta = valor
}

/** Notificação tocada com o app aberto. */
export function __tocarNotificacao(valor: NotificationResponse): void {
  ultimaResposta = valor
  for (const ouvinte of ouvintesResposta) ouvinte(valor)
}

export function __trocarToken(data: string): void {
  tokenDispositivo = data
  avisarOuvintesToken()
}

export function __reiniciar(): void {
  tokenDispositivo = 'fcm-teste'
  ultimaResposta = null
  ouvintesResposta.clear()
  ouvintesToken.clear()
}
