import { z } from 'zod'

export const SENHA_MIN = 8
export const SENHA_MAX = 128

/** Política de senha do UC06: 8–128 caracteres, ao menos uma letra e um número. */
export const senhaSchema = z
  .string()
  .min(SENHA_MIN, { error: `A senha deve ter ao menos ${SENHA_MIN} caracteres.` })
  .max(SENHA_MAX, { error: `A senha deve ter no máximo ${SENHA_MAX} caracteres.` })
  .regex(/\p{L}/u, { error: 'A senha deve ter ao menos uma letra.' })
  .regex(/\p{N}/u, { error: 'A senha deve ter ao menos um número.' })
