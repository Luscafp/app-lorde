import * as Sentry from '@sentry/react-native'
import { dispositivoRegistradoSchema, type RegistrarDispositivo } from '@atletica/shared'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { features } from '@/config/features'
import { CANAL_NOTIFICACAO_PADRAO } from '@/config/notificacoes'
import { api } from '@/infra/api/cliente'
import { useSessao } from '@/infra/sessao/store'
import type { EstadoPermissao, FontePermissao, Permissao } from './permissao'

export const CHAVE_PERMISSAO_PERGUNTADA = 'push.permissaoPerguntada'
export const CHAVE_DISPOSITIVO_ID = 'push.dispositivoId'

const ROTA = '/me/dispositivos'

function idProjeto(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  return extra?.eas?.projectId
}

function permissaoDe(status: Notifications.NotificationPermissionsStatus): Permissao {
  if (status.granted) return 'concedida'
  return status.status === Notifications.PermissionStatus.UNDETERMINED ? 'nao-perguntada' : 'negada'
}

export async function permissaoJaPerguntada(): Promise<boolean> {
  return (await SecureStore.getItemAsync(CHAVE_PERMISSAO_PERGUNTADA)) === 'true'
}

export async function marcarPermissaoPerguntada(): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_PERMISSAO_PERGUNTADA, 'true')
}

export async function estadoPermissao(): Promise<EstadoPermissao> {
  const [status, dispositivoId] = await Promise.all([
    Notifications.getPermissionsAsync(),
    SecureStore.getItemAsync(CHAVE_DISPOSITIVO_ID),
  ])
  return { permissao: permissaoDe(status), registrado: dispositivoId !== null }
}

async function registrar(): Promise<void> {
  const { data: tokenPush } = await Notifications.getExpoPushTokenAsync({ projectId: idProjeto() })
  const corpo: RegistrarDispositivo = { tokenPush, plataforma: 'android' }
  const { id } = dispositivoRegistradoSchema.parse(await api.post(ROTA, corpo))
  await SecureStore.setItemAsync(CHAVE_DISPOSITIVO_ID, id)
}

/** Erros (sem rede, 5xx) vão ao Sentry; a próxima abertura tenta de novo (épico #36 §6). */
export async function registrarSeConcedida(): Promise<void> {
  try {
    if ((await Notifications.getPermissionsAsync()).granted) await registrar()
  } catch (erro) {
    Sentry.captureException(erro)
  }
}

export async function solicitarPermissaoERegistrar(): Promise<void> {
  await marcarPermissaoPerguntada()
  const status = await Notifications.requestPermissionsAsync()
  if (status.granted) await registrarSeConcedida()
}

export const fontePermissao: FontePermissao = {
  estado: estadoPermissao,
  solicitarERegistrar: solicitarPermissaoERegistrar,
}

/** Logout online (épico #36 §3.2 item 8): a falha não impede a saída; o ouvinte da API cobre. */
export async function removerDispositivo(sinal?: AbortSignal): Promise<void> {
  const id = await SecureStore.getItemAsync(CHAVE_DISPOSITIVO_ID)
  if (!id) return
  try {
    await api.delete(`${ROTA}/${id}`, { sinal })
  } finally {
    await SecureStore.deleteItemAsync(CHAVE_DISPOSITIVO_ID)
  }
}

export function configurarExibicao(): void {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
  })
  void Notifications.setNotificationChannelAsync(CANAL_NOTIFICACAO_PADRAO, {
    name: 'Notificações',
    importance: Notifications.AndroidImportance.HIGH,
  }).catch((erro: unknown) => Sentry.captureException(erro))
}

/** Registra a cada abertura autenticada, a cada login e quando o token muda. */
export function acompanharRegistroPush(): () => void {
  const autenticado = () => useSessao.getState().status === 'autenticado'
  if (autenticado()) void registrarSeConcedida()

  const sessao = useSessao.subscribe((estado, anterior) => {
    if (estado.status === 'autenticado' && anterior.status !== 'autenticado') {
      void registrarSeConcedida()
    }
  })
  const token = Notifications.addPushTokenListener(() => {
    if (autenticado()) void registrarSeConcedida()
  })
  return () => {
    sessao()
    token.remove()
  }
}

/** Com a flag `notificacoes` desligada nenhuma API de push é chamada. */
export function iniciarNotificacoes(): void {
  if (!features.notificacoes) return
  configurarExibicao()
  acompanharRegistroPush()
}
