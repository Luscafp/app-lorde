import { Papel } from '@atletica/shared'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { DetalheAuditoria } from '@/features/auditoria'
import { useTemNivelMinimo } from '@/infra/sessao/use-tem-nivel-minimo'

export default function RegistroAuditoria() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const ehPresidencia = useTemNivelMinimo(Papel.PRESIDENTE)
  if (!ehPresidencia) return <Redirect href="/painel" />
  return <DetalheAuditoria id={id} />
}
