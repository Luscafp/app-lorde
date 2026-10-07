import { router } from 'expo-router'
import { ListaNoticiasPainel, type NavegacaoNoticias } from '@/features/noticias'

const ir: NavegacaoNoticias = {
  nova: () => router.push('/painel/noticias/nova'),
  editar: (id) => router.push(`/painel/noticias/${id}`),
}

export default function NoticiasPainel() {
  return <ListaNoticiasPainel ir={ir} />
}
