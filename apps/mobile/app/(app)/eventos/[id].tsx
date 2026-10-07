import { router, useLocalSearchParams } from 'expo-router'
import { TelaEvento } from '@/features/eventos'
import { ParticipacaoAcoes } from '@/features/participacoes'

export default function Evento() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <TelaEvento
      id={id}
      aoGerenciar={() => router.push(`/painel/eventos/${id}`)}
      acoesParticipacao={(evento) => (
        <ParticipacaoAcoes
          evento={evento}
          aoAbrirTime={(timeId) => router.push(`/times/${timeId}`)}
        />
      )}
    />
  )
}
