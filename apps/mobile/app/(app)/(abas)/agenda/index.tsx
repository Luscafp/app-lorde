import { router, useLocalSearchParams } from 'expo-router'
import { lerParametros, TelaAgenda, type ParametrosAgenda } from '@/features/eventos'

/** Segmento e filtros na URL: "Voltar" preserva a seleção. */
export default function Agenda() {
  const { aba, filtros } = lerParametros(useLocalSearchParams<ParametrosAgenda>())
  return (
    <TelaAgenda
      aba={aba}
      filtros={filtros}
      aoMudarAba={(novaAba) => router.setParams({ aba: novaAba })}
      aoMudarFiltros={({ tipo, modalidadeId }) => router.setParams({ tipo, modalidadeId })}
      aoAbrirEvento={({ id }) => router.push(`/eventos/${id}`)}
    />
  )
}
