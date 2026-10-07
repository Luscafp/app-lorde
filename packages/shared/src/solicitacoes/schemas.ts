import { z } from 'zod'
import { StatusSolicitacao } from '../enums/solicitacao'
import { paginacaoQuerySchema } from '../utils/paginacao'

export const solicitacaoIdSchema = z.object({ id: z.uuid({ error: 'Id inválido.' }) }).strict()

const statusSolicitacaoSchema = z.enum(StatusSolicitacao, {
  error: 'Use PENDENTE, APROVADA, REJEITADA ou CANCELADA.',
})

/** `?status=` repetível: um valor chega como texto, vários como lista. */
const emLista = (valor: unknown) => (typeof valor === 'string' ? [valor] : valor)

/** Query de `GET /solicitacoes` (épico #18 §7); sem `status`, só as pendentes. */
export const listarSolicitacoesQuerySchema = paginacaoQuerySchema
  .extend({
    status: z
      .preprocess(emLista, z.array(statusSolicitacaoSchema).min(1))
      .transform((lista) => [...new Set(lista)])
      .default([StatusSolicitacao.PENDENTE]),
    timeId: z.uuid({ error: 'Time inválido.' }).optional(),
  })
  .strict()

export type ListarSolicitacoesQuery = z.infer<typeof listarSolicitacoesQuerySchema>
export type FiltrosSolicitacoes = { status?: StatusSolicitacao[]; timeId?: string }
