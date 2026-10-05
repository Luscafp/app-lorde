import { router } from 'expo-router'
import { EditarPerfil } from '@/features/perfil'

export default function TelaEditarPerfil() {
  return <EditarPerfil aoSalvar={() => router.back()} />
}
