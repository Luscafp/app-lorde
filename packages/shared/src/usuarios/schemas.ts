import { z } from 'zod'
import { nomeSchema, SENHA_MAX, senhaSchema } from '../auth/schemas'
import { Papel } from '../enums/papel'
import { paginacaoQuerySchema } from '../utils/paginacao'

export const BUSCA_MIN = 2
export const BUSCA_MAX = 100

/** `EXCLUIDO` só aparece no detalhe: a lista omite contas excluídas. */
export const SituacaoUsuario = {
  ATIVO: 'ATIVO',
  DESATIVADO: 'DESATIVADO',
  EXCLUIDO: 'EXCLUIDO',
} as const

export type SituacaoUsuario = (typeof SituacaoUsuario)[keyof typeof SituacaoUsuario]

export const SITUACOES_FILTRO = [SituacaoUsuario.ATIVO, SituacaoUsuario.DESATIVADO] as const

export type SituacaoFiltro = (typeof SITUACOES_FILTRO)[number]

/** Query de `GET /usuarios` (issue #27 §3.1). */
export const listarUsuariosQuerySchema = paginacaoQuerySchema
  .extend({
    busca: z
      .string()
      .trim()
      .min(BUSCA_MIN, { error: `Digite ao menos ${BUSCA_MIN} caracteres.` })
      .max(BUSCA_MAX, { error: `A busca deve ter no máximo ${BUSCA_MAX} caracteres.` })
      .optional(),
    papel: z.enum(Papel, { error: 'Papel inválido.' }).optional(),
    situacao: z.enum(SITUACOES_FILTRO, { error: 'Situação inválida.' }).optional(),
  })
  .strict()

export const alterarSituacaoSchema = z.object({ ativo: z.boolean() }).strict()

/** Corpo de `PUT /usuarios/:id/papel` (issue #28). */
export const alterarPapelSchema = z
  .object({
    papel: z.enum(Papel, { error: 'Papel inválido.' }),
    confirmarSubstituicao: z.boolean().optional(),
  })
  .strict()

/** `.strict()`: `email`, `papel` e `ativo` no corpo → `400` (issue #13 §10). */
export const atualizarPerfilSchema = z.object({ nome: nomeSchema }).strict()

/** O formato `usuarios/{usuarioId}/perfil/{uuid}.{ext}` é conferido na API (`validarKey`). */
export const atualizarFotoSchema = z.object({ fotoKey: z.string().max(300) }).strict()

export const alterarSenhaSchema = z
  .object({
    senhaAtual: z
      .string()
      .min(1, { error: 'Informe a senha atual.' })
      .max(SENHA_MAX, { error: `A senha deve ter no máximo ${SENHA_MAX} caracteres.` }),
    novaSenha: senhaSchema,
  })
  .strict()

/** Formulário do app: `confirmarSenha` não é enviado. */
export const alterarSenhaFormSchema = alterarSenhaSchema
  .extend({ confirmarSenha: z.string() })
  .refine(({ novaSenha, confirmarSenha }) => novaSenha === confirmarSenha, {
    path: ['confirmarSenha'],
    error: 'As senhas não conferem.',
  })

export const excluirContaSchema = z
  .object({
    senha: z
      .string()
      .min(1, { error: 'Informe a senha.' })
      .max(SENHA_MAX, { error: `A senha deve ter no máximo ${SENHA_MAX} caracteres.` }),
  })
  .strict()

export type ListarUsuariosQuery = z.infer<typeof listarUsuariosQuerySchema>
export type FiltrosUsuarios = Omit<z.input<typeof listarUsuariosQuerySchema>, 'page' | 'limit'>
export type AlterarSituacao = z.infer<typeof alterarSituacaoSchema>
export type AlterarPapel = z.infer<typeof alterarPapelSchema>
export type AtualizarPerfil = z.infer<typeof atualizarPerfilSchema>
export type AtualizarFoto = z.infer<typeof atualizarFotoSchema>
export type AlterarSenha = z.infer<typeof alterarSenhaSchema>
export type AlterarSenhaForm = z.infer<typeof alterarSenhaFormSchema>
export type ExcluirConta = z.infer<typeof excluirContaSchema>
