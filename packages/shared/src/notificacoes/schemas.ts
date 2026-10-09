import type { z } from 'zod'
import { preferenciasSchema } from './dtos'

export const atualizarPreferenciasSchema = preferenciasSchema
  .partial()
  .strict()
  .refine((valor) => Object.keys(valor).length > 0, { error: 'Informe ao menos um campo.' })

export type AtualizarPreferencias = z.infer<typeof atualizarPreferenciasSchema>
