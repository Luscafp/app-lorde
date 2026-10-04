/** Papel do usuário na atlética, do menor para o maior nível (Documento de Requisitos 7.2). */
export const Papel = {
  ATLETA: 'ATLETA',
  DIRETOR: 'DIRETOR',
  PRESIDENTE: 'PRESIDENTE',
  VICE_PRESIDENTE: 'VICE_PRESIDENTE',
  ADMINISTRADOR: 'ADMINISTRADOR',
} as const

export type Papel = (typeof Papel)[keyof typeof Papel]
