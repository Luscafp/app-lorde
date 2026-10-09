import { z } from 'zod'
import { respostaPaginadaSchema } from '../utils/paginacao'

/** `null` = ação do sistema (job). Conta excluída: nome anonimizado e `anonimizado: true`. */
export const autorAuditoriaSchema = z
  .object({ id: z.uuid(), nome: z.string(), anonimizado: z.boolean() })
  .strict()
  .nullable()

/** `acao`/`entidade` como texto: registro antigo com código fora do catálogo continua legível. */
export const registroAuditoriaResumoSchema = z
  .object({
    id: z.uuid(),
    acao: z.string(),
    entidade: z.string(),
    entidadeId: z.uuid(),
    autor: autorAuditoriaSchema,
    criadoEm: z.iso.datetime(),
    /** Só os nomes dos campos alterados; `dados` completo fica no detalhe. */
    resumo: z.object({ campos: z.array(z.string()) }).strict(),
  })
  .strict()

export const listaAuditoriaSchema = respostaPaginadaSchema(registroAuditoriaResumoSchema)

const nomesPorIdSchema = z.record(z.string(), z.string())

export const registroAuditoriaDetalheSchema = registroAuditoriaResumoSchema
  .extend({
    /** Ex.: "Treino Futsal 12/10/2026 19:00"; `null` quando o registro não existe mais. */
    rotuloRegistro: z.string().nullable(),
    /** `{ antes, depois, contexto? }` sem campos sensíveis. */
    dados: z.unknown(),
    /** Ids citados em `dados` → nome: usuários e demais registros (time, evento...). */
    referencias: z.object({ usuarios: nomesPorIdSchema, registros: nomesPorIdSchema }).strict(),
  })
  .strict()

export type AutorAuditoria = z.infer<typeof autorAuditoriaSchema>
export type RegistroAuditoriaResumo = z.infer<typeof registroAuditoriaResumoSchema>
export type ListaAuditoria = z.infer<typeof listaAuditoriaSchema>
export type RegistroAuditoriaDetalhe = z.infer<typeof registroAuditoriaDetalheSchema>
