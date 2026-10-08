import { router } from 'expo-router'
import { TelaHome } from '@/features/home'

export default function Inicio() {
  return (
    <TelaHome
      aoAbrirAgenda={(aba) => router.navigate({ pathname: '/agenda', params: { aba } })}
      aoAbrirTimes={() => router.navigate('/times')}
      aoAbrirNoticias={() => router.push('/noticias')}
      aoAbrirEvento={(id) => router.push(`/eventos/${id}`)}
      aoAbrirNoticia={(id) => router.push(`/noticias/${id}`)}
      aoAbrirPerfil={() => router.navigate('/perfil')}
      aoVerificarEmail={() => router.push('/verificar-email')}
    />
  )
}
