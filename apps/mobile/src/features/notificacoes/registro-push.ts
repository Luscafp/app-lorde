import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { features } from '@/config/features'
import { CANAL_NOTIFICACAO_PADRAO } from '@/config/notificacoes'
import { ApiErro } from '@/infra/api/api-erro'
import { useSessao } from '@/infra/sessao/store'
import { excluirDispositivo, registrarDispositivo } from './api'
import type { EstadoPermissao, FontePermissao, Permissao } from './permissao'

export const CHAVE_PERMISSAO_PERGUNTADA = 'push.permissaoPerguntada'
export const CHAVE_DISPOSITIVO_ID = 'push.dispositivoId'

function idProjeto(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  return extra?.eas?.projectId
}

function permissaoDe(status: Notifications.NotificationPermissionsStatus): Permissao {
  if (status.granted) return 'concedida'
  return status.status === Notifications.PermissionStatus.UNDETERMINED ? 'nao-perguntada' : 'negada'
}

/** Sem resposta da API ou `4xx` não vão ao Sentry (convenções §4.1). */
function reportarErro(erro: unknown): void {
  if (!(erro instanceof ApiErro) || erro.status >= 500) Sentry.captureException(erro)
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
  const { id } = await registrarDispositivo({ tokenPush, plataforma: 'android' })
  await SecureStore.setItemAsync(CHAVE_DISPOSITIVO_ID, id)
}

/** Falhas são silenciosas; a próxima abertura tenta de novo (épico #36 §6). */
export async function registrarSeConcedida(): Promise<void> {
  try {
    if ((await Notifications.getPermissionsAsync()).granted) await registrar()
  } catch (erro) {
    reportarErro(erro)
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
    await excluirDispositivo(id, sinal)
  } finally {
    await esquecerDispositivo()
  }
}

/** Logout offline: a API remove o aparelho quando a sessão pendente é revogada. */
export async function esquecerDispositivo(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE_DISPOSITIVO_ID)
}

function configurarExibicao(): void {
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
  }).catch(reportarErro)
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
