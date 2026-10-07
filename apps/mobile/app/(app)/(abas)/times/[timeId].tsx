import { router, useLocalSearchParams } from 'expo-router'
import { TelaTime } from '@/features/times'

export default function Time() {
  const { timeId } = useLocalSearchParams<{ timeId: string }>()
  return <TelaTime timeId={timeId} aoVoltar={() => router.dismissTo('/times')} />
}
