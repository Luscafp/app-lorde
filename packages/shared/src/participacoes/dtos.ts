import { z } from 'zod'

/** Respostas do elenco atual do time. */
export const contagemParticipacaoSchema = z
  .object({
    confirmados: z.number().int(),
    recusados: z.number().int(),
    semResposta: z.number().int(),
    elenco: z.number().int(),
  })
  .strict()

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
export type ContagemParticipacao = z.infer<typeof contagemParticipacaoSchema>
