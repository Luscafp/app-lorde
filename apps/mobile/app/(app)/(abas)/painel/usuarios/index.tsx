import { Papel } from '@atletica/shared'
import { Redirect, useRouter } from 'expo-router'
import { ListaUsuarios } from '@/features/usuarios'
import { useTemNivelMinimo } from '@/infra/sessao/use-tem-nivel-minimo'

export default function Usuarios() {
  const router = useRouter()
  const ehPresidencia = useTemNivelMinimo(Papel.PRESIDENTE)
  if (!ehPresidencia) return <Redirect href="/painel" />
  return <ListaUsuarios aoAbrir={(id) => router.push(`/painel/usuarios/${id}`)} />
}
