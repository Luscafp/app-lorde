import { useLocalSearchParams } from 'expo-router'
import { TelaNoticia } from '@/features/noticias'

export default function Noticia() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <TelaNoticia id={id} />
}
