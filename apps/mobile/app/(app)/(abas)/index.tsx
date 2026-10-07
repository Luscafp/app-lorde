import { TelaProvisoria } from '@/components/tela-provisoria'
import { useMarcarHomePronta } from '@/infra/sentry'

// Conteúdo na #25; a Home com dados (#79) passa a fechar o span só quando os dados chegarem.
export default function Inicio() {
  useMarcarHomePronta(true)
  return <TelaProvisoria titulo="Início" />
}
