import { z } from 'zod'
import { respostaPaginadaSchema } from '../utils/paginacao'

/** Item de `GET /times` e corpo de `GET /times/:id` (épico #16 §7). */
export const timeDtoSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    ativo: z.boolean(),
    modalidade: z.object({ id: z.uuid(), nome: z.string(), icone: z.string() }).strict(),
    atletica: z
      .object({
        id: z.uuid(),
        nome: z.string(),
        sigla: z.string().nullable(),
        propria: z.boolean(),
      })
      .strict(),
    /** Sempre `null` em time adversário. */
    capitao: z.object({ id: z.uuid(), nome: z.string() }).strict().nullable(),
    /** Membros com `saidaEm` nulo; `0` em time adversário. */
    totalMembros: z.number().int(),
  })
  .strict()

export const listaTimesSchema = respostaPaginadaSchema(timeDtoSchema)

export type TimeDto = z.infer<typeof timeDtoSchema>
export type ListaTimes = z.infer<typeof listaTimesSchema>
