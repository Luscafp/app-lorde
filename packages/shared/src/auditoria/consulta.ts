import { z } from 'zod'
import { DATA_LOCAL, localParaUtc, somarDias } from '../utils/datas'
import { paginacaoQuerySchema, respostaPaginadaSchema } from '../utils/paginacao'
import { AcaoAuditoria, EntidadeAuditoria } from './acoes'

export const PERIODO_PADRAO_DIAS = 30
export const PERIODO_MAXIMO_DIAS = 366

const DIA_MS = 24 * 60 * 60_000

const ACOES = Object.values(AcaoAuditoria)
const ENTIDADES = Object.values(EntidadeAuditoria)

function limiteValido(valor: string): boolean {
  if (DATA_LOCAL.test(valor)) {
    try {
      localParaUtc(valor, '00:00')
      return true
    } catch {
      return false
    }
  }
  return z.iso.datetime({ offset: true }).safeParse(valor).success
}

/** `aaaa-mm-dd` (dia inteiro em America/Fortaleza) ou instante ISO-8601. */
const limiteSchema = z
  .string({ error: 'Data inválida.' })
  .refine(limiteValido, { error: 'Use aaaa-mm-dd ou data e hora ISO-8601.' })

export interface LimitesPeriodo {
  de?: string
  ate?: string
}

export interface Periodo {
  de: Date
  ate: Date
}

/** Dia local → 00:00 em `de` e 23:59:59.999 em `ate`; sem `de`, os últimos 30 dias até `ate`. */
export function periodoAuditoria({ de, ate }: LimitesPeriodo, agora = Date.now()): Periodo {
  const fim = !ate
    ? new Date(agora)
    : DATA_LOCAL.test(ate)
      ? new Date(localParaUtc(somarDias(ate, 1), '00:00').getTime() - 1)
      : new Date(ate)
  const inicio = !de
    ? new Date(fim.getTime() - PERIODO_PADRAO_DIAS * DIA_MS)
    : DATA_LOCAL.test(de)
      ? localParaUtc(de, '00:00')
      : new Date(de)
  return { de: inicio, ate: fim }
}

/** Query de `GET /auditoria` (issue #39 §3). */
export const listarAuditoriaQuerySchema = paginacaoQuerySchema
  .extend({
    entidade: z.enum(ENTIDADES, { error: 'Entidade inválida.' }).optional(),
    entidadeId: z.uuid({ error: 'Registro inválido.' }).optional(),
    usuarioId: z.uuid({ error: 'Autor inválido.' }).optional(),
    acao: z.enum(ACOES, { error: 'Ação inválida.' }).optional(),
    de: limiteSchema.optional(),
    ate: limiteSchema.optional(),
  })
  .strict()
  .superRefine((query, ctx) => {
    if (query.entidadeId && !query.entidade) {
      ctx.addIssue({ code: 'custom', path: ['entidadeId'], message: 'Informe a entidade.' })
    }
    if (!limiteValido(query.de ?? '2000-01-01') || !limiteValido(query.ate ?? '2000-01-01')) {
      return
    }
    const { de, ate } = periodoAuditoria(query)
    if (ate < de) {
      ctx.addIssue({
        code: 'custom',
        path: ['ate'],
        message: 'A data final deve ser igual ou posterior à inicial.',
      })
    } else if (ate.getTime() - de.getTime() > PERIODO_MAXIMO_DIAS * DIA_MS) {
      ctx.addIssue({
        code: 'custom',
        path: ['de'],
        message: `O período deve ter no máximo ${PERIODO_MAXIMO_DIAS} dias.`,
      })
    }
  })

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
    /** Ex.: "Treino Futsal 12/10/2026 19:00"; `null` quando o registro não existe mais. */
    rotuloRegistro: z.string().nullable(),
    autor: autorAuditoriaSchema,
    criadoEm: z.iso.datetime(),
  })
  .strict()

export const listaAuditoriaSchema = respostaPaginadaSchema(registroAuditoriaResumoSchema)

export const registroAuditoriaDetalheSchema = registroAuditoriaResumoSchema
  .extend({
    /** `{ antes, depois, contexto? }` sem campos sensíveis. */
    dados: z.unknown(),
    /** Ids citados em `dados` → nome (usuário, time, evento...), quando resolvidos. */
    referencias: z.record(z.string(), z.string()),
  })
  .strict()

export type ListarAuditoriaQuery = z.infer<typeof listarAuditoriaQuerySchema>
export type FiltrosAuditoria = Omit<z.input<typeof listarAuditoriaQuerySchema>, 'page' | 'limit'>
export type AutorAuditoria = z.infer<typeof autorAuditoriaSchema>
export type RegistroAuditoriaResumo = z.infer<typeof registroAuditoriaResumoSchema>
export type ListaAuditoria = z.infer<typeof listaAuditoriaSchema>
export type RegistroAuditoriaDetalhe = z.infer<typeof registroAuditoriaDetalheSchema>
