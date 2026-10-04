import { Redirect } from 'expo-router'
import { TelaProvisoria } from '@/components/ui/tela-provisoria'
import { useVePainel } from '@/infra/sessao/use-ve-painel'

// Conteúdo nas issues de diretoria.
export default function Painel() {
  const vePainel = useVePainel()
  if (!vePainel) return <Redirect href="/" />
  return <TelaProvisoria titulo="Painel" />
}
