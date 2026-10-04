import { z } from 'zod'

export const PAGINA_PADRAO = 1
export const LIMITE_PADRAO = 20
export const LIMITE_MAXIMO = 50

/** Query de paginação por offset (convenções §4.4). */
export const paginacaoQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(PAGINA_PADRAO),
    limit: z.coerce.number().int().min(1).max(LIMITE_MAXIMO).default(LIMITE_PADRAO),
  })
  .strict()

export type PaginacaoQuery = z.infer<typeof paginacaoQuerySchema>

export function respostaPaginadaSchema<T extends z.ZodType>(item: T) {
  return z
    .object({
      items: z.array(item),
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
    })
    .strict()
}

export interface RespostaPaginada<T> {
  items: T[]
  page: number
  limit: number
  total: number
}
