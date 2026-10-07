import { z } from 'zod'
import { StatusSolicitacao } from '../enums/solicitacao'

/** Resposta de `POST /times/:id/solicitacoes` e `POST /solicitacoes/:id/cancelar` (épico #18 §7). */
export const solicitacaoDtoSchema = z
  .object({
    id: z.uuid(),
    timeId: z.uuid(),
    status: z.enum(StatusSolicitacao),
    criadaEm: z.iso.datetime(),
    canceladaEm: z.iso.datetime().nullable(),
  })
  .strict()

/** Situação do usuário no time, em `GET /times/:id`; `null` em time adversário. */
export const minhaSituacaoDtoSchema = z
  .object({
    membro: z.boolean(),
    solicitacaoPendente: z.object({ id: z.uuid(), criadaEm: z.iso.datetime() }).strict().nullable(),
  })
  .strict()

export type SolicitacaoDto = z.infer<typeof solicitacaoDtoSchema>
export type MinhaSituacaoDto = z.infer<typeof minhaSituacaoDtoSchema>
