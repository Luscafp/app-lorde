import { z } from 'zod'

/** Corpo de `PUT /eventos/:id/participacao`; o usuário vem sempre do token. */
export const responderParticipacaoSchema = z
  .object({ confirmado: z.boolean({ error: 'Informe se você vai.' }) })
  .strict()

export type ResponderParticipacao = z.infer<typeof responderParticipacaoSchema>
