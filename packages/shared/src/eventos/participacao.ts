import { StatusEvento } from '../enums/evento'
import type { Instante } from '../utils/datas'

/** Mesmos `code` de erro do `PUT /eventos/:id/participacao` (#24), na ordem de avaliação. */
export const MotivoBloqueioResposta = {
  NAO_MEMBRO_DO_ELENCO: 'NAO_MEMBRO_DO_ELENCO',
  EVENTO_CANCELADO: 'EVENTO_CANCELADO',
  EVENTO_NAO_AGENDADO: 'EVENTO_NAO_AGENDADO',
  EVENTO_JA_INICIADO: 'EVENTO_JA_INICIADO',
} as const

export type MotivoBloqueioResposta =
  (typeof MotivoBloqueioResposta)[keyof typeof MotivoBloqueioResposta]

export interface AvaliacaoResposta {
  podeResponder: boolean
  motivoBloqueioResposta: MotivoBloqueioResposta | null
}

function bloqueio(motivo: MotivoBloqueioResposta): AvaliacaoResposta {
  return { podeResponder: false, motivoBloqueioResposta: motivo }
}

/** RN30: `souMembro ∧ status = AGENDADO ∧ agora < inicio`. */
export function avaliarResposta(
  evento: { status: StatusEvento; inicio: Instante },
  souMembro: boolean,
  agora: Instante,
): AvaliacaoResposta {
  if (!souMembro) return bloqueio(MotivoBloqueioResposta.NAO_MEMBRO_DO_ELENCO)
  if (evento.status === StatusEvento.CANCELADO) {
    return bloqueio(MotivoBloqueioResposta.EVENTO_CANCELADO)
  }
  if (evento.status !== StatusEvento.AGENDADO) {
    return bloqueio(MotivoBloqueioResposta.EVENTO_NAO_AGENDADO)
  }
  if (new Date(agora).getTime() >= new Date(evento.inicio).getTime()) {
    return bloqueio(MotivoBloqueioResposta.EVENTO_JA_INICIADO)
  }
  return { podeResponder: true, motivoBloqueioResposta: null }
}
