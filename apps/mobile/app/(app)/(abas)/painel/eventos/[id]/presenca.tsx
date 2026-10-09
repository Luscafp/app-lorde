import { router, useLocalSearchParams } from 'expo-router'
import { TelaPresenca } from '@/features/participacoes'

export default function PresencaEvento() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <TelaPresenca eventoId={id} aoSalvar={() => router.back()} />
}
