import { router } from 'expo-router'
import { ListaEventosPainel, type NavegacaoEventos } from '@/features/eventos'

const ir: NavegacaoEventos = {
  novo: () => router.push('/painel/eventos/novo'),
  abrir: (id) => router.push(`/painel/eventos/${id}`),
}

export default function EventosPainel() {
  return <ListaEventosPainel ir={ir} />
}
