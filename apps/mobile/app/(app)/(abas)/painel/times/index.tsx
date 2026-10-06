import { router } from 'expo-router'
import { ListaTimesPainel, type NavegacaoTimes } from '@/features/times'

const ir: NavegacaoTimes = {
  novo: () => router.push('/painel/times/novo'),
  editar: (id) => router.push(`/painel/times/${id}/editar`),
  elenco: (id) => router.push(`/painel/times/${id}/elenco`),
  modalidades: () => router.push('/painel/modalidades'),
  adversarias: () => router.push('/painel/times/adversarias'),
}

export default function TimesPainel() {
  return <ListaTimesPainel ir={ir} />
}
