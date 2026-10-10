import { rotaNotificacaoPermitida } from '@atletica/shared'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { guardarDestinoAposLogin } from '@/infra/sessao/destino'
import { useSessao } from '@/infra/sessao/store'

const HOME = '/'

/** `data.url` fora da lista permitida (épico #36 §3.4) abre a Home. */
export function destinoDaNotificacao(resposta: Notifications.NotificationResponse): string {
  const url: unknown = resposta.notification.request.content.data?.url
  return rotaNotificacaoPermitida(url) ? url : HOME
}

/**
 * Toque com o app aberto (ouvinte) ou fechado (última resposta). Enquanto a sessão carrega a
 * resposta fica para a última resposta; sem sessão, o destino espera o login.
 */
export function useDeepLinkNotificacao(): void {
  const router = useRouter()
  const status = useSessao((estado) => estado.status)
  const ultimaResposta = Notifications.useLastNotificationResponse()
  const tratadas = useRef(new Set<string>())

  const tratar = useCallback(
    (resposta: Notifications.NotificationResponse) => {
      const sessao = useSessao.getState().status
      if (sessao === 'carregando') return
      if (resposta.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return
      const identificador = resposta.notification.request.identifier
      if (tratadas.current.has(identificador)) return
      tratadas.current.add(identificador)
      Notifications.clearLastNotificationResponse()

      const destino = destinoDaNotificacao(resposta)
      if (sessao === 'autenticado') {
        router.push(destino)
        return
      }
      guardarDestinoAposLogin(destino)
      router.navigate('/login')
    },
    [router],
  )

  useEffect(() => {
    const assinatura = Notifications.addNotificationResponseReceivedListener(tratar)
    return () => assinatura.remove()
  }, [tratar])

  useEffect(() => {
    if (ultimaResposta && status !== 'carregando') tratar(ultimaResposta)
  }, [ultimaResposta, status, tratar])
}

/** Montado só com a flag `notificacoes` ligada: o hook chama APIs de push. */
export function DeepLinkNotificacao() {
  useDeepLinkNotificacao()
  return null
}
