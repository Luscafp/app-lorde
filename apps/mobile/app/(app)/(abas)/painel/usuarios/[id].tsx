import { Papel } from '@atletica/shared'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { DetalheUsuario } from '@/features/usuarios'
import { useTemNivelMinimo } from '@/infra/sessao/use-ve-painel'

export default function Usuario() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const ehPresidencia = useTemNivelMinimo(Papel.PRESIDENTE)
  if (!ehPresidencia) return <Redirect href="/painel" />
  return <DetalheUsuario id={id} />
}
