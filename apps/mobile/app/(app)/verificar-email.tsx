import { router } from 'expo-router'
import { TelaVerificarEmail } from '@/features/verificacao-email'

export default function VerificarEmail() {
  return <TelaVerificarEmail aoConcluir={() => router.back()} />
}
