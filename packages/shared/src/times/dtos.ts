import { z } from 'zod'
import { minhaSituacaoDtoSchema } from '../solicitacoes/dtos'
import { respostaPaginadaSchema } from '../utils/paginacao'

/** Item de `GET /times` e corpo de `GET /times/:id` (épico #16 §7). */
export const timeDtoSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    ativo: z.boolean(),
    modalidade: z.object({ id: z.uuid(), nome: z.string(), icone: z.string() }).strict(),
    atletica: z
      .object({
        id: z.uuid(),
        nome: z.string(),
        sigla: z.string().nullable(),
        propria: z.boolean(),
      })
      .strict(),
    /** Sempre `null` em time adversário. */
    capitao: z.object({ id: z.uuid(), nome: z.string() }).strict().nullable(),
    /** Membros com `saidaEm` nulo; `0` em time adversário. */
    totalMembros: z.number().int(),
  })
  .strict()

export const listaTimesSchema = respostaPaginadaSchema(timeDtoSchema)

/** Corpo de `GET /times/:id`: acrescenta a situação do usuário (épico #18 §7). */
export const timeDetalheDtoSchema = timeDtoSchema
  .extend({ minhaSituacao: minhaSituacaoDtoSchema.nullable() })
  .strict()

/** Item de `GET /times/:id/elenco`: nunca traz e-mail (épico #16 §10). */
export const membroElencoDtoSchema = z
  .object({
    usuarioId: z.uuid(),
    nome: z.string(),
    fotoUrl: z.string().nullable(),
    entradaEm: z.iso.datetime(),
    capitao: z.boolean(),
  })
  .strict()

/** Sem paginação (convenções §4.4). */
export const elencoDtoSchema = z
  .object({ items: z.array(membroElencoDtoSchema), total: z.number().int() })
  .strict()

/** Resposta de `POST /times/:id/sair` (#34). */
export const saidaTimeDtoSchema = z
  .object({
    timeId: z.uuid(),
    saidaEm: z.iso.datetime(),
    capitaniaRemovida: z.boolean(),
    participacoesRemovidas: z.number().int(),
  })
  .strict()

export type TimeDto = z.infer<typeof timeDtoSchema>
export type TimeDetalheDto = z.infer<typeof timeDetalheDtoSchema>
export type ListaTimes = z.infer<typeof listaTimesSchema>
export type MembroElencoDto = z.infer<typeof membroElencoDtoSchema>
export type ElencoDto = z.infer<typeof elencoDtoSchema>
export type SaidaTimeDto = z.infer<typeof saidaTimeDtoSchema>
