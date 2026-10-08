import { z } from 'zod'
import { TipoEvento } from '../enums/evento'
import {
  DATA_LOCAL,
  diaDaSemana,
  HORARIO_HHMM,
  hojeLocal,
  localParaUtc,
  somarDias,
  somarMeses,
  type Instante,
} from '../utils/datas'
import { EscopoOcorrencia } from './escopo'
import {
  criarEventoSchema,
  editarEventoSchema,
  localEventoSchema,
  observacoesEventoSchema,
} from './schemas'

/** RN13: a série vai até 6 meses de calendário após o início. */
export const MESES_MAX_SERIE = 6

export const recorrenciaSchema = z
  .object({
    dataInicio: z.iso.date({ error: 'Informe a data de início.' }),
    horario: z.string({ error: 'Informe o horário.' }).regex(HORARIO_HHMM, {
      error: 'Informe o horário (HH:mm).',
    }),
    diasSemana: z
      .array(
        z
          .number({ error: 'Dia da semana inválido.' })
          .int({ error: 'Dia da semana inválido.' })
          .min(0, { error: 'Dia da semana inválido.' })
          .max(6, { error: 'Dia da semana inválido.' }),
        { error: 'Escolha ao menos um dia da semana.' },
      )
      .min(1, { error: 'Escolha ao menos um dia da semana.' })
      .max(7, { error: 'Escolha no máximo 7 dias.' })
      .refine((dias) => new Set(dias).size === dias.length, { error: 'Dia da semana repetido.' })
      .transform((dias) => [...dias].sort((a, b) => a - b)),
    dataFim: z.iso.date({ error: 'Informe até quando repetir.' }),
  })
  .strict()
  .check((ctx) => {
    const { dataInicio, dataFim } = ctx.value
    if (!DATA_LOCAL.test(dataInicio) || !DATA_LOCAL.test(dataFim)) return
    const falhar = (campo: 'dataInicio' | 'dataFim', message: string) =>
      ctx.issues.push({ code: 'custom', path: [campo], message, input: ctx.value[campo] })

    if (dataInicio < hojeLocal())
      falhar('dataInicio', 'A data de início não pode estar no passado.')
    if (dataFim < dataInicio) falhar('dataFim', 'A data final deve ser depois do início.')
    else if (dataFim > somarMeses(dataInicio, MESES_MAX_SERIE)) {
      falhar('dataFim', `A série pode ter no máximo ${MESES_MAX_SERIE} meses.`)
    }
  })

export type Recorrencia = z.infer<typeof recorrenciaSchema>

/** Uma ocorrência por dia local de `diasSemana`, no `horario` local; omite as já iniciadas. */
export function gerarDatasSerie(
  { dataInicio, dataFim, diasSemana, horario }: Recorrencia,
  agora: Instante = Date.now(),
): Date[] {
  const limite = new Date(agora).getTime()
  const dias = new Set(diasSemana)
  const datas: Date[] = []
  for (let dia = dataInicio; dia <= dataFim; dia = somarDias(dia, 1)) {
    if (!dias.has(diaDaSemana(dia))) continue
    const inicio = localParaUtc(dia, horario)
    if (inicio.getTime() > limite) datas.push(inicio)
  }
  return datas
}

/** `POST /eventos` de um treino recorrente: `recorrencia` substitui `inicio` (RN13). */
export const criarSerieSchema = z
  .object({
    tipo: z.literal(TipoEvento.TREINO, { error: 'Só treinos podem ser recorrentes.' }),
    timeId: z.uuid({ error: 'Selecione o time.' }),
    local: localEventoSchema,
    observacoes: observacoesEventoSchema.optional(),
    timeAdversarioId: z.null({ error: 'Treino não tem adversário.' }).optional(),
    recorrencia: recorrenciaSchema,
  })
  .strict()

/** `ESTA_E_SEGUINTES` não muda dia nem time (#20 §3 item 8). */
export const editarSeguintesSchema = z
  .object({
    escopo: z.literal(EscopoOcorrencia.ESTA_E_SEGUINTES),
    horario: z.string().regex(HORARIO_HHMM, { error: 'Informe o horário (HH:mm).' }).optional(),
    local: localEventoSchema.optional(),
    observacoes: observacoesEventoSchema.optional(),
  })
  .strict()
  .refine((dados) => Object.keys(dados).length > 1, { error: 'Informe ao menos um campo.' })

type Corpo = Record<string, unknown>

/** Valida o corpo pelo schema que `usaPrimeiro` escolher, mantendo os caminhos dos erros. */
function porCorpo<A extends z.ZodType, B extends z.ZodType>(
  usaPrimeiro: (corpo: Corpo) => boolean,
  primeiro: A,
  segundo: B,
) {
  return z.looseObject({}).transform((corpo, ctx): z.output<A> | z.output<B> => {
    const resultado = (usaPrimeiro(corpo) ? primeiro : segundo).safeParse(corpo)
    if (resultado.success) return resultado.data
    for (const { path, message } of resultado.error.issues) {
      ctx.issues.push({ code: 'custom', path, message, input: corpo })
    }
    return z.NEVER
  })
}

/** Corpo de `POST /eventos`: `{ inicio }` xor `{ recorrencia }`. */
export const criarEventoOuSerieSchema = porCorpo(
  (corpo) => 'recorrencia' in corpo,
  criarSerieSchema,
  criarEventoSchema,
)

/** Corpo de `PATCH /eventos/:id`. */
export const editarOcorrenciaSchema = porCorpo(
  (corpo) => corpo.escopo === EscopoOcorrencia.ESTA_E_SEGUINTES,
  editarSeguintesSchema,
  editarEventoSchema,
)

export type CriarSerie = z.infer<typeof criarSerieSchema>
export type EditarSeguintes = z.infer<typeof editarSeguintesSchema>
