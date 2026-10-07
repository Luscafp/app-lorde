import { z } from 'zod'
import { StatusSolicitacao } from '../enums/solicitacao'
import { respostaPaginadaSchema } from '../utils/paginacao'

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

/** Só nome e foto (RNF15): sem e-mail do solicitante nem do avaliador. */
const pessoaSolicitacaoSchema = z
  .object({ id: z.uuid(), nome: z.string(), fotoUrl: z.string().nullable() })
  .strict()

/** Item de `GET /solicitacoes` e resposta de `/aprovar` e `/rejeitar`. */
export const solicitacaoPainelDtoSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(StatusSolicitacao),
    criadaEm: z.iso.datetime(),
    avaliadaEm: z.iso.datetime().nullable(),
    canceladaEm: z.iso.datetime().nullable(),
    usuario: pessoaSolicitacaoSchema,
    time: z
      .object({
        id: z.uuid(),
        nome: z.string(),
        modalidade: z.object({ id: z.uuid(), nome: z.string(), icone: z.string() }).strict(),
      })
      .strict(),
    avaliadoPor: pessoaSolicitacaoSchema.nullable(),
  })
  .strict()

export const listaSolicitacoesSchema = respostaPaginadaSchema(solicitacaoPainelDtoSchema)

export type SolicitacaoDto = z.infer<typeof solicitacaoDtoSchema>
export type MinhaSituacaoDto = z.infer<typeof minhaSituacaoDtoSchema>
export type SolicitacaoPainelDto = z.infer<typeof solicitacaoPainelDtoSchema>
export type ListaSolicitacoes = z.infer<typeof listaSolicitacoesSchema>
