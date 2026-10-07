import { z } from 'zod'
import { contagemParticipacaoSchema } from '../eventos/dtos'

/** Resposta de `PUT /eventos/:id/participacao` (#24). */
export const participacaoRespondidaDtoSchema = z
  .object({
    eventoId: z.uuid(),
    confirmado: z.boolean(),
    respondidoEm: z.iso.datetime(),
    contagem: contagemParticipacaoSchema,
  })
  .strict()

export type ParticipacaoRespondidaDto = z.infer<typeof participacaoRespondidaDtoSchema>
