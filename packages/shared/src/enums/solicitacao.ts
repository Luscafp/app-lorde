export const StatusSolicitacao = {
  PENDENTE: 'PENDENTE',
  APROVADA: 'APROVADA',
  REJEITADA: 'REJEITADA',
  CANCELADA: 'CANCELADA',
} as const

export type StatusSolicitacao = (typeof StatusSolicitacao)[keyof typeof StatusSolicitacao]
