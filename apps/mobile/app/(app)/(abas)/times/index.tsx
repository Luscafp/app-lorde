import { router } from 'expo-router'
import { ListaModalidadesTimes } from '@/features/times'

export default function Times() {
  return <ListaModalidadesTimes aoAbrirTime={(id) => router.push(`/times/${id}`)} />
}
