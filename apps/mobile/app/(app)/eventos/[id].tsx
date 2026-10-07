import { router, useLocalSearchParams } from 'expo-router'
import { TelaEvento } from '@/features/eventos'

export default function Evento() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <TelaEvento
      id={id}
      aoGerenciar={() => router.push(`/painel/eventos/${id}`)}
      aoAbrirTime={(timeId) => router.push(`/times/${timeId}`)}
    />
  )
}
