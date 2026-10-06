import { z } from 'zod'
import { TipoEvento } from '../enums/evento'

export const LOCAL_EVENTO_MIN = 2
export const LOCAL_EVENTO_MAX = 120
export const OBSERVACOES_EVENTO_MAX = 500
export const DIAS_PASSADO_EVENTO = 365
export const DIAS_FUTURO_EVENTO = 730

const DIA_MS = 24 * 60 * 60 * 1000

/** `inicio` entre hoje − 365 dias e hoje + 730 dias (épico #19 §3). */
export function inicioNoIntervalo(inicio: string, agora = Date.now()): boolean {
  const instante = new Date(inicio).getTime()
  return (
    instante >= agora - DIAS_PASSADO_EVENTO * DIA_MS &&
    instante <= agora + DIAS_FUTURO_EVENTO * DIA_MS
  )
}

export const inicioEventoSchema = z.iso
  .datetime({ offset: true, abort: true, error: 'Informe a data e o horário.' })
  .refine((inicio) => inicioNoIntervalo(inicio), {
    error: `A data deve estar entre ${DIAS_PASSADO_EVENTO} dias atrás e ${DIAS_FUTURO_EVENTO} dias à frente.`,
  })

export const localEventoSchema = z
  .string({ error: 'Informe o local.' })
  .trim()
  .min(LOCAL_EVENTO_MIN, { error: `Informe o local (mín. ${LOCAL_EVENTO_MIN} caracteres).` })
  .max(LOCAL_EVENTO_MAX, { error: `O local deve ter no máximo ${LOCAL_EVENTO_MAX} caracteres.` })

/** Texto vazio vira `null` (limpa as observações). */
export const observacoesEventoSchema = z
  .string()
  .trim()
  .max(OBSERVACOES_EVENTO_MAX, {
    error: `As observações devem ter no máximo ${OBSERVACOES_EVENTO_MAX} caracteres.`,
  })
  .transform((texto) => texto || null)
  .nullable()

const timeIdSchema = z.uuid({ error: 'Selecione o time.' })
const timeAdversarioIdSchema = z.uuid({ error: 'Selecione o adversário.' })

const camposComuns = {
  timeId: timeIdSchema,
  inicio: inicioEventoSchema,
  local: localEventoSchema,
  observacoes: observacoesEventoSchema.optional(),
}

/** RN11/RN12: Jogo exige adversário; Treino não aceita (épico #19 §3). */
export const criarEventoSchema = z.discriminatedUnion(
  'tipo',
  [
    z
      .object({
        tipo: z.literal(TipoEvento.JOGO),
        ...camposComuns,
        timeAdversarioId: timeAdversarioIdSchema,
      })
      .strict(),
    z
      .object({
        tipo: z.literal(TipoEvento.TREINO),
        ...camposComuns,
        timeAdversarioId: z.null({ error: 'Treino não tem adversário.' }).optional(),
      })
      .strict(),
  ],
  { error: 'Escolha Jogo ou Treino.' },
)

/** `tipo`, `status` e placar não são editáveis aqui; `timeAdversarioId` só vale para Jogo. */
export const editarEventoSchema = z
  .object({
    inicio: inicioEventoSchema,
    local: localEventoSchema,
    observacoes: observacoesEventoSchema,
    timeId: timeIdSchema,
    timeAdversarioId: timeAdversarioIdSchema,
  })
  .partial()
  .strict()
  .refine((dados) => Object.keys(dados).length > 0, { error: 'Informe ao menos um campo.' })

/** Corpo vazio; a #20 acrescenta `escopo`. */
export const cancelarEventoSchema = z.object({}).strict().default({})

export type CriarEvento = z.infer<typeof criarEventoSchema>
export type EditarEvento = z.infer<typeof editarEventoSchema>
export type CriarEventoForm = z.input<typeof criarEventoSchema>
