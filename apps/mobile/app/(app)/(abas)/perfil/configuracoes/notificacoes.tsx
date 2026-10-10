import { fontePermissao, TelaPreferenciasNotificacao } from '@/features/notificacoes'

export default function Notificacoes() {
  return <TelaPreferenciasNotificacao permissao={fontePermissao} />
}
