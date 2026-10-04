import { z } from 'zod'
import { Papel } from '../enums/papel'

export const usuarioSessaoSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    email: z.string(),
    fotoUrl: z.string().nullable(),
    papel: z.enum(Papel),
    atleticaId: z.uuid(),
  })
  .strict()

/** Resposta única de cadastro, login e refresh (convenções §11.2); não existe `expiresIn`. */
export const respostaSessaoSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    accessTokenExpiraEm: z.iso.datetime(),
    usuario: usuarioSessaoSchema,
  })
  .strict()

export type UsuarioSessao = z.infer<typeof usuarioSessaoSchema>
export type RespostaSessao = z.infer<typeof respostaSessaoSchema>
