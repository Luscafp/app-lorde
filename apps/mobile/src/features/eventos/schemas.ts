import {
  criarEventoSchema,
  criarSerieSchema,
  EscopoOcorrencia,
  formatarData,
  formatarHora,
  localParaUtc,
  observacoesEventoSchema,
  TipoEvento,
  type CriarEvento,
  type CriarSerie,
  type EditarEvento,
  type EditarSeguintes,
  type EventoDto,
  type Recorrencia,
} from '@atletica/shared'
import { z } from 'zod'

const DATA_FORM = /^(\d{2})\/(\d{2})\/(\d{4})$/
const HORA_FORM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Erros de `inicio` e da recorrência, do Zod ou da API, aparecem nos campos da tela. */
export const CAMPO_DO_FORM: Record<string, string> = {
  inicio: 'data',
  'recorrencia.dataInicio': 'data',
  'recorrencia.horario': 'hora',
  'recorrencia.diasSemana': 'diasSemana',
  'recorrencia.dataFim': 'dataFim',
}

/** `"dd/mm/aaaa"` → `"aaaa-mm-dd"`, se o dia existir. */
export function dataLocal(data: string): string | undefined {
  const [, dia, mes, ano] = DATA_FORM.exec(data) ?? []
  if (!dia || !mes || !ano) return undefined
  const local = `${ano}-${mes}-${dia}`
  try {
    localParaUtc(local, '00:00')
    return local
  } catch {
    return undefined
  }
}

/** Data e horário locais (`FUSO_PADRAO`) → `inicio` ISO UTC. */
export function paraInicio(data: string, hora: string): string | undefined {
  const dia = dataLocal(data)
  return dia && HORA_FORM.test(hora) ? localParaUtc(dia, hora).toISOString() : undefined
}

const camposFormSchema = z.object({
  tipo: z.enum(TipoEvento),
  timeId: z.string(),
  timeAdversarioId: z.string().nullable(),
  data: z.string(),
  hora: z.string(),
  local: z.string(),
  observacoes: z.string(),
  recorrente: z.boolean(),
  diasSemana: z.array(z.number()),
  dataFim: z.string(),
})

type CamposForm = z.infer<typeof camposFormSchema>

/** Recorrência montada da tela, ou `undefined` enquanto alguma data ou o horário é inválido. */
export function recorrenciaDoForm(
  form: Pick<CamposForm, 'data' | 'hora' | 'diasSemana' | 'dataFim'>,
): Recorrencia | undefined {
  const dataInicio = dataLocal(form.data)
  const dataFim = dataLocal(form.dataFim)
  if (!dataInicio || !dataFim || !HORA_FORM.test(form.hora)) return undefined
  return { dataInicio, dataFim, horario: form.hora, diasSemana: form.diasSemana }
}

/** Campos da tela validados pelo `criarEventoSchema` (#70) ou, recorrente, pelo `criarSerieSchema` (#20). */
export const eventoFormSchema = camposFormSchema.transform(
  (form, ctx): CriarEvento | CriarSerie => {
    const falhar = (campo: PropertyKey, message: string) =>
      ctx.issues.push({ code: 'custom', path: [campo], message, input: form })

    if (!dataLocal(form.data)) falhar('data', 'Informe a data (dd/mm/aaaa).')
    if (!HORA_FORM.test(form.hora)) falhar('hora', 'Informe o horário (HH:mm).')
    if (form.tipo === TipoEvento.TREINO && form.recorrente) return validarSerie(form, falhar)
    const inicio = paraInicio(form.data, form.hora)

    const evento = criarEventoSchema.safeParse({
      tipo: form.tipo,
      timeId: form.timeId,
      inicio,
      local: form.local,
      observacoes: form.observacoes,
      ...(form.tipo === TipoEvento.JOGO && { timeAdversarioId: form.timeAdversarioId }),
    })
    for (const { path, message } of evento.error?.issues ?? []) {
      const [campo = ''] = path
      if (campo === 'inicio' && !inicio) continue
      falhar(CAMPO_DO_FORM[String(campo)] ?? campo, message)
    }
    return evento.data ?? z.NEVER
  },
)

function validarSerie(
  form: CamposForm,
  falhar: (campo: PropertyKey, message: string) => void,
): CriarSerie {
  if (!dataLocal(form.dataFim)) falhar('dataFim', 'Informe até quando repetir (dd/mm/aaaa).')
  const recorrencia = recorrenciaDoForm(form)
  const serie = criarSerieSchema.safeParse({
    tipo: form.tipo,
    timeId: form.timeId,
    local: form.local,
    observacoes: form.observacoes,
    recorrencia,
  })
  for (const { path, message } of serie.error?.issues ?? []) {
    const campo = path.join('.')
    if (campo === 'recorrencia' || (!recorrencia && campo.startsWith('recorrencia.'))) continue
    falhar(CAMPO_DO_FORM[campo] ?? campo, message)
  }
  return serie.data ?? z.NEVER
}

/** Evento `FINALIZADO`: só as observações são editáveis. */
export const observacoesFormSchema = camposFormSchema
  .extend({ observacoes: z.string().pipe(observacoesEventoSchema.unwrap()) })
  .transform(({ observacoes }) => ({ observacoes }))

export type EventoFormEntrada = z.input<typeof eventoFormSchema>
export type EventoFormSaida = CriarEvento | CriarSerie | z.output<typeof observacoesFormSchema>

export function valoresIniciais(evento?: EventoDto): EventoFormEntrada {
  return {
    tipo: evento?.tipo ?? TipoEvento.JOGO,
    timeId: evento?.time.id ?? '',
    timeAdversarioId: evento?.timeAdversario?.id ?? null,
    data: evento ? formatarData(evento.inicio) : '',
    hora: evento ? formatarHora(evento.inicio) : '',
    local: evento?.local ?? '',
    observacoes: evento?.observacoes ?? '',
    recorrente: false,
    diasSemana: [],
    dataFim: '',
  }
}

/** Só os campos que mudaram; vazio quando nada mudou. */
export function paraEdicao(dados: EventoFormSaida, evento: EventoDto): Partial<EditarEvento> {
  const observacoes = dados.observacoes ?? null
  const mudancas: Partial<EditarEvento> = {}
  if (observacoes !== evento.observacoes) mudancas.observacoes = observacoes
  if (!('tipo' in dados) || 'recorrencia' in dados) return mudancas

  if (dados.timeId !== evento.time.id) mudancas.timeId = dados.timeId
  if (dados.tipo === TipoEvento.JOGO && dados.timeAdversarioId !== evento.timeAdversario?.id) {
    mudancas.timeAdversarioId = dados.timeAdversarioId
  }
  if (Date.parse(dados.inicio) !== Date.parse(evento.inicio)) mudancas.inicio = dados.inicio
  if (dados.local !== evento.local) mudancas.local = dados.local
  return mudancas
}

/** "Este e os seguintes": só horário, local e observações que mudaram; `null` se nada mudou. */
export function paraEdicaoSeguintes(
  dados: EventoFormSaida,
  evento: EventoDto,
): EditarSeguintes | null {
  const mudancas = paraEdicao(dados, evento)
  const campos: Omit<EditarSeguintes, 'escopo'> = {}
  if (mudancas.inicio) campos.horario = formatarHora(mudancas.inicio)
  if (mudancas.local !== undefined) campos.local = mudancas.local
  if (mudancas.observacoes !== undefined) campos.observacoes = mudancas.observacoes
  if (Object.keys(campos).length === 0) return null
  return { escopo: EscopoOcorrencia.ESTA_E_SEGUINTES, ...campos }
}
