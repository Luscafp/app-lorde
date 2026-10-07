import Ionicons from '@expo/vector-icons/Ionicons'
import type { EventoResumoDto } from '@atletica/shared'
import { Selo } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { EventoCard } from '@/features/eventos/components/evento-card'
import { rotuloInicio } from '@/features/eventos/formatacao'

type Props = { treino: EventoResumoDto; aoAbrir: (treino: EventoResumoDto) => void }

export function CartaoTreino({ treino, aoAbrir }: Props) {
  return (
    <EventoCard
      evento={treino}
      aoAbrir={aoAbrir}
      data={rotuloInicio(treino.inicio)}
      selos={treino.serieId !== null && <Selo texto="RECORRENTE" />}
      direita={<Ionicons name="chevron-forward" size={20} color={paleta['texto-suave']} />}
    />
  )
}
