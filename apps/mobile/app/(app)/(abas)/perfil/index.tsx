import { router } from 'expo-router'
import { TelaPerfil } from '@/features/perfil'

export default function Perfil() {
  return (
    <TelaPerfil
      aoAbrirConfiguracoes={() => router.push('/perfil/configuracoes')}
      aoAbrirTime={(id) => router.push(`/times/${id}`)}
      aoAbrirEvento={(id) => router.push(`/eventos/${id}`)}
      aoConhecerTimes={() => router.navigate('/times')}
      aoVerificarEmail={() => router.push('/verificar-email')}
    />
  )
}
