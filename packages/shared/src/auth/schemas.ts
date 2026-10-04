import { z } from 'zod'

export const SENHA_MIN = 8
export const SENHA_MAX = 128
export const EMAIL_MAX = 254
export const NOME_MIN = 2
export const NOME_MAX = 80
export const REFRESH_TOKEN_MAX = 200

/** Teto contra DoS no Argon2, também no login. */
const senhaLimitada = z
  .string()
  .max(SENHA_MAX, { error: `A senha deve ter no máximo ${SENHA_MAX} caracteres.` })

/** Política de senha do UC06: 8–128 caracteres, ao menos uma letra e um número. */
export const senhaSchema = senhaLimitada
  .min(SENHA_MIN, { error: `A senha deve ter ao menos ${SENHA_MIN} caracteres.` })
  .regex(/\p{L}/u, { error: 'A senha deve ter ao menos uma letra.' })
  .regex(/\p{N}/u, { error: 'A senha deve ter ao menos um número.' })

/** Normalizado (`trim` + minúsculas) antes de validar e de buscar (RN01). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX, { error: `O e-mail deve ter no máximo ${EMAIL_MAX} caracteres.` })
  .pipe(z.email({ error: 'Informe um e-mail válido.' }))

export const nomeSchema = z
  .string()
  .trim()
  .min(NOME_MIN, { error: `O nome deve ter ao menos ${NOME_MIN} caracteres.` })
  .max(NOME_MAX, { error: `O nome deve ter no máximo ${NOME_MAX} caracteres.` })

/** Sem a política de senha: contas criadas antes de uma mudança nela continuam entrando. */
export const loginSchema = z
  .object({
    email: emailSchema,
    senha: senhaLimitada.min(1, { error: 'Informe a senha.' }),
  })
  .strict()

/** A igualdade com `TERMOS_VERSAO` é conferida na API (`409 TERMOS_DESATUALIZADOS`). */
export const cadastroSchema = z
  .object({
    nome: nomeSchema,
    email: emailSchema,
    senha: senhaSchema,
    aceiteTermos: z.literal(true, {
      error: 'Aceite os Termos de Uso e a Política de Privacidade.',
    }),
    versaoTermos: z.string().min(1).max(20),
  })
  .strict()

/** Formulário do app: `confirmarSenha` não é enviado e `versaoTermos` entra só no envio. */
export const cadastroFormSchema = cadastroSchema
  .omit({ versaoTermos: true })
  .extend({ confirmarSenha: z.string() })
  .refine(({ senha, confirmarSenha }) => senha === confirmarSenha, {
    path: ['confirmarSenha'],
    error: 'As senhas não conferem.',
  })

/** O formato `<sessaoId>.<segredo>` é conferido na API: refresh → `401`, logout → `204`. */
export const refreshTokenSchema = z
  .object({ refreshToken: z.string().min(1).max(REFRESH_TOKEN_MAX) })
  .strict()

export type LoginEntrada = z.infer<typeof loginSchema>
export type CadastroEntrada = z.infer<typeof cadastroSchema>
export type CadastroForm = z.infer<typeof cadastroFormSchema>
export type RefreshTokenEntrada = z.infer<typeof refreshTokenSchema>
