/** Alcance da edição ou do cancelamento de uma ocorrência de série (RN13, UC16 A1/A2). */
export const EscopoOcorrencia = {
  ESTA: 'ESTA',
  ESTA_E_SEGUINTES: 'ESTA_E_SEGUINTES',
} as const

export type EscopoOcorrencia = (typeof EscopoOcorrencia)[keyof typeof EscopoOcorrencia]
