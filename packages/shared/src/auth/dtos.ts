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

export const MENSAGEM_RECUPERACAO_ENVIADA =
  'Se este e-mail estiver cadastrado, você receberá um código em instantes.'

/** `202` de `POST /auth/senha/esqueci`: sempre igual, exista ou não o e-mail (UC09). */
export const respostaEsqueciSenhaSchema = z
  .object({ message: z.literal(MENSAGEM_RECUPERACAO_ENVIADA) })
  .strict()

export const respostaVerificarCodigoSchema = z.object({ valido: z.literal(true) }).strict()

export type UsuarioSessao = z.infer<typeof usuarioSessaoSchema>
export type RespostaSessao = z.infer<typeof respostaSessaoSchema>
export type RespostaEsqueciSenha = z.infer<typeof respostaEsqueciSenhaSchema>
export type RespostaVerificarCodigo = z.infer<typeof respostaVerificarCodigoSchema>
