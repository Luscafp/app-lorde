import { router } from 'expo-router'
import { AlterarSenha } from '@/features/perfil'

export default function TelaAlterarSenha() {
  return <AlterarSenha aoConcluir={() => router.back()} />
}
