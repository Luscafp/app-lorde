export const TipoEvento = {
  JOGO: 'JOGO',
  TREINO: 'TREINO',
} as const

export type TipoEvento = (typeof TipoEvento)[keyof typeof TipoEvento]

export const StatusEvento = {
  AGENDADO: 'AGENDADO',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  FINALIZADO: 'FINALIZADO',
  CANCELADO: 'CANCELADO',
} as const

export type StatusEvento = (typeof StatusEvento)[keyof typeof StatusEvento]

/** Resultado de um JOGO finalizado (RN15). */
export const Resultado = {
  VITORIA: 'VITORIA',
  EMPATE: 'EMPATE',
  DERROTA: 'DERROTA',
} as const

export type Resultado = (typeof Resultado)[keyof typeof Resultado]
