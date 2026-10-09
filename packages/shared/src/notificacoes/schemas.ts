import { z } from 'zod'
import { preferenciasSchema } from './dtos'

export const atualizarPreferenciasSchema = preferenciasSchema
  .partial()
  .strict()
  .refine((valor) => Object.keys(valor).length > 0, { error: 'Informe ao menos um campo.' })

export type AtualizarPreferencias = z.infer<typeof atualizarPreferenciasSchema>

/** Corpo de `POST /me/dispositivos` (épico #36 §6). */
export const registrarDispositivoSchema = z
  .object({
    tokenPush: z
      .string()
      .max(255)
      .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, { error: 'Token push inválido.' }),
    plataforma: z.enum(['android'], { error: 'Plataforma não suportada.' }),
  })
  .strict()

export type RegistrarDispositivo = z.infer<typeof registrarDispositivoSchema>
