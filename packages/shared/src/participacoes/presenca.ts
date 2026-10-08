import { StatusEvento } from '../enums/evento'

/** Resposta do atleta exibida como apoio na lista de presença (épico #35 §3.1 item 4). */
export const RespostaPresenca = {
  CONFIRMOU: 'CONFIRMOU',
  RECUSOU: 'RECUSOU',
  SEM_RESPOSTA: 'SEM_RESPOSTA',
} as const

export type RespostaPresenca = (typeof RespostaPresenca)[keyof typeof RespostaPresenca]

export const MAXIMO_PRESENTES = 200

const STATUS_COM_PRESENCA: readonly StatusEvento[] = [
  StatusEvento.EM_ANDAMENTO,
  StatusEvento.FINALIZADO,
]

/** RN31: presença só em eventos em andamento ou finalizados. */
export function aceitaPresenca(status: StatusEvento): boolean {
  return STATUS_COM_PRESENCA.includes(status)
}

export function respostaPresenca(confirmado: boolean | null | undefined): RespostaPresenca {
  if (confirmado === true) return RespostaPresenca.CONFIRMOU
  if (confirmado === false) return RespostaPresenca.RECUSOU
  return RespostaPresenca.SEM_RESPOSTA
}
