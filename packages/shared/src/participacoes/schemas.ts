import { z } from 'zod'
import { MAXIMO_PRESENTES } from './presenca'

/** Corpo de `PUT /eventos/:id/participacao`; o usuário vem sempre do token. */
export const responderParticipacaoSchema = z
  .object({ confirmado: z.boolean({ error: 'Informe se você vai.' }) })
  .strict()

/** Corpo de `PUT /eventos/:id/presencas`: lista completa dos presentes (substituição). */
export const registrarPresencasSchema = z
  .object({
    presentes: z
      .array(z.uuid())
      .max(MAXIMO_PRESENTES, `No máximo ${MAXIMO_PRESENTES} atletas.`)
      .refine((ids) => new Set(ids).size === ids.length, 'Atleta repetido.'),
  })
  .strict()

export type ResponderParticipacao = z.infer<typeof responderParticipacaoSchema>
export type RegistrarPresencas = z.infer<typeof registrarPresencasSchema>
