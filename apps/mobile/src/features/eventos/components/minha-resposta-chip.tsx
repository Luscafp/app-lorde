import { StatusEvento, type EventoResumoDto } from '@atletica/shared'
import { Selo } from '@/components/ui'
import { paleta } from '@/features/atletica'

type Props = { evento: Pick<EventoResumoDto, 'status' | 'souMembro' | 'minhaParticipacao'> }

/** Só para quem é do elenco e enquanto o evento está agendado. */
export function MinhaRespostaChip({ evento }: Props) {
  if (!evento.souMembro || evento.status !== StatusEvento.AGENDADO) return null
  const confirmado = evento.minhaParticipacao?.confirmado
  if (confirmado === true) return <Selo texto="VOU" cor={paleta.sucesso} />
  if (confirmado === false) return <Selo texto="NÃO VOU" cor={paleta.erro} />
  return <Selo texto="RESPONDER" cor={paleta.alerta} />
}
