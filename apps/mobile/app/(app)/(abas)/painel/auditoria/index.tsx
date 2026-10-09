import { Papel } from '@atletica/shared'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import {
  lerParametros,
  ListaAuditoria,
  paraParametros,
  type ParametrosAuditoria,
} from '@/features/auditoria'
import { useTemNivelMinimo } from '@/infra/sessao/use-tem-nivel-minimo'

export default function Auditoria() {
  const parametros = useLocalSearchParams<ParametrosAuditoria>()
  const ehPresidencia = useTemNivelMinimo(Papel.PRESIDENTE)
  if (!ehPresidencia) return <Redirect href="/painel" />
  return (
    <ListaAuditoria
      filtros={lerParametros(parametros)}
      aoMudarFiltros={(filtros) => router.setParams(paraParametros(filtros))}
      aoAbrir={(id) => router.push(`/painel/auditoria/${id}`)}
    />
  )
}
