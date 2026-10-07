import Ionicons from '@expo/vector-icons/Ionicons'
import type { EventoResumoDto } from '@atletica/shared'
import { Selo } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { EventoCard, rotuloInicio } from '@/features/eventos'

type Props = { treino: EventoResumoDto; aoAbrir: (id: string) => void }

export function CartaoTreino({ treino, aoAbrir }: Props) {
  return (
    <EventoCard
      evento={treino}
      aoAbrir={({ id }) => aoAbrir(id)}
      rotuloData={rotuloInicio(treino.inicio)}
      selos={treino.serieId !== null && <Selo texto="RECORRENTE" />}
      direita={<Ionicons name="chevron-forward" size={20} color={paleta['texto-suave']} />}
    />
  )
}
