import { router } from 'expo-router'
import { TelaAtivarNotificacoes } from '@/features/notificacoes'

function concluir() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}

export default function AtivarNotificacoes() {
  return <TelaAtivarNotificacoes aoConcluir={concluir} />
}
