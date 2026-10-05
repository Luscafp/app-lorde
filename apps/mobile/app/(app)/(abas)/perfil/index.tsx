import { router } from 'expo-router'
import { TelaPerfil } from '@/features/perfil'

export default function Perfil() {
  return (
    <TelaPerfil
      aoAbrirConfiguracoes={() => router.push('/perfil/configuracoes')}
      aoAbrirTime={(id) => router.push(`/times/${id}`)}
      aoConhecerTimes={() => router.navigate('/times')}
    />
  )
}
