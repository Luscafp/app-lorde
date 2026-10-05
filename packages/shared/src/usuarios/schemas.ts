import { z } from 'zod'
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

export type ListarUsuariosQuery = z.infer<typeof listarUsuariosQuerySchema>
export type FiltrosUsuarios = Omit<z.input<typeof listarUsuariosQuerySchema>, 'page' | 'limit'>
export type AlterarSituacao = z.infer<typeof alterarSituacaoSchema>
