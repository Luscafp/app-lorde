import { useLocalSearchParams } from 'expo-router'
import { ElencoPainel } from '@/features/times'

export default function ElencoTime() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ElencoPainel timeId={id} />
}
