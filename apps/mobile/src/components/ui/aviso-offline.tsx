import { MENSAGEM_ACAO_OFFLINE } from '@/infra/query/use-acao-online'
import { Texto } from './texto'

export function AvisoOffline({ online }: { online: boolean }) {
  if (online) return null
  return (
    <Texto variante="legenda" className="text-center" accessibilityLiveRegion="polite">
      {MENSAGEM_ACAO_OFFLINE}
    </Texto>
  )
}
