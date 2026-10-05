import { z } from 'zod'
import { paginacaoQuerySchema } from '../utils/paginacao'

/** Query de `GET /noticias`; a #32 acrescenta `tagId`. */
export const listarNoticiasQuerySchema = paginacaoQuerySchema

export const noticiaIdParamSchema = z.object({ id: z.uuid({ error: 'Id inválido.' }) }).strict()

export type ListarNoticiasQuery = z.infer<typeof listarNoticiasQuerySchema>
