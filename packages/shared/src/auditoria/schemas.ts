import { z } from 'zod'
import { DATA_LOCAL, dataLocalValida, localParaUtc, somarDias } from '../utils/datas'
import { paginacaoQuerySchema } from '../utils/paginacao'
import { AcaoAuditoria, EntidadeAuditoria } from './acoes'

export const PERIODO_PADRAO_DIAS = 30
export const PERIODO_MAXIMO_DIAS = 366

const DIA_MS = 24 * 60 * 60_000

const ACOES = Object.values(AcaoAuditoria)
const ENTIDADES = Object.values(EntidadeAuditoria)

function limiteValido(valor: string): boolean {
  if (DATA_LOCAL.test(valor)) return dataLocalValida(valor)
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

function inicioDoLimite(valor: string): Date {
  return DATA_LOCAL.test(valor) ? localParaUtc(valor, '00:00') : new Date(valor)
}

function fimDoLimite(valor: string): Date {
  if (!DATA_LOCAL.test(valor)) return new Date(valor)
  return new Date(localParaUtc(somarDias(valor, 1), '00:00').getTime() - 1)
}

/** Dia local → 00:00 em `de` e 23:59:59.999 em `ate`; sem `de`, os últimos 30 dias até `ate`. */
export function periodoAuditoria({ de, ate }: LimitesPeriodo, agora = Date.now()): Periodo {
  const fim = ate ? fimDoLimite(ate) : new Date(agora)
  const inicio = de ? inicioDoLimite(de) : new Date(fim.getTime() - PERIODO_PADRAO_DIAS * DIA_MS)
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
        path: ['ate'],
        message: `O período deve ter no máximo ${PERIODO_MAXIMO_DIAS} dias.`,
      })
    }
  })

export type ListarAuditoriaQuery = z.infer<typeof listarAuditoriaQuerySchema>
export type FiltrosAuditoria = Omit<z.input<typeof listarAuditoriaQuerySchema>, 'page' | 'limit'>
