import { useRouter } from 'expo-router'
import { ListaNoticias } from '@/features/noticias'

export default function Noticias() {
  const router = useRouter()
  return <ListaNoticias aoAbrir={(id) => router.push(`/noticias/${id}`)} />
}
