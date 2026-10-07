import { z } from 'zod'

export const solicitacaoIdSchema = z.object({ id: z.uuid({ error: 'Id inválido.' }) }).strict()
