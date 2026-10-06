import { useLocalSearchParams } from 'expo-router'
import { PreviaNoticia } from '@/features/noticias'

export default function Previa() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <PreviaNoticia id={id} />
}
