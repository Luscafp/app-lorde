/** Fuso das datas exibidas e dos limites de dia (convenções §4.5); nunca use offset fixo. */
export const FUSO_PADRAO = 'America/Fortaleza'

/** Instante UTC: ISO-8601 (como a API trafega), `Date` ou milissegundos. */
export type Instante = string | number | Date

interface PartesLocais {
  ano: string
  mes: string
  dia: string
  hora: string
  minuto: string
}

const formatador = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO_PADRAO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const DATA_LOCAL = /^(\d{4})-(\d{2})-(\d{2})$/
const HORA_LOCAL = /^([01]\d|2[0-3]):([0-5]\d)$/

function paraDate(instante: Instante): Date {
  const data = new Date(instante)
  if (Number.isNaN(data.getTime())) throw new Error(`Data inválida: ${String(instante)}`)
  return data
}

function partesLocais(instante: Instante): PartesLocais {
  const partes: Record<string, string> = {}
  for (const { type, value } of formatador.formatToParts(paraDate(instante))) partes[type] = value
  return {
    ano: partes.year ?? '',
    mes: partes.month ?? '',
    dia: partes.day ?? '',
    hora: partes.hour ?? '',
    minuto: partes.minute ?? '',
  }
}

/** Diferença, em ms, entre o relógio local do fuso e o UTC no instante dado. */
function deslocamento(ms: number): number {
  const { ano, mes, dia, hora, minuto } = partesLocais(ms)
  const local = Date.UTC(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto))
  return local - Math.floor(ms / 60_000) * 60_000
}

/** `"01/10/2026 19:00"` no fuso padrão. */
export function formatarDataHora(instante: Instante): string {
  return `${formatarData(instante)} ${formatarHora(instante)}`
}

/** `"01/10/2026"` no fuso padrão. */
export function formatarData(instante: Instante): string {
  const { ano, mes, dia } = partesLocais(instante)
  return `${dia}/${mes}/${ano}`
}

/** `"19:00"` no fuso padrão. */
export function formatarHora(instante: Instante): string {
  const { hora, minuto } = partesLocais(instante)
  return `${hora}:${minuto}`
}

/** Dia local no formato `"aaaa-mm-dd"`, para agrupar e comparar por dia. */
export function chaveDiaLocal(instante: Instante): string {
  const { ano, mes, dia } = partesLocais(instante)
  return `${ano}-${mes}-${dia}`
}

/** Data (`"aaaa-mm-dd"`) e hora (`"HH:mm"`) no fuso padrão → instante UTC. */
export function localParaUtc(data: string, hora: string): Date {
  const [, ano, mes, dia] = DATA_LOCAL.exec(data) ?? []
  const [, h, min] = HORA_LOCAL.exec(hora) ?? []
  if (!ano || !mes || !dia || !h || !min) throw new Error(`Data ou hora inválida: ${data} ${hora}`)

  const relogio = Date.UTC(Number(ano), Number(mes) - 1, Number(dia), Number(h), Number(min))
  const calendario = new Date(relogio)
  if (calendario.getUTCDate() !== Number(dia) || calendario.getUTCMonth() !== Number(mes) - 1) {
    throw new Error(`Data inválida: ${data}`)
  }

  const estimativa = relogio - deslocamento(relogio)
  return new Date(relogio - deslocamento(estimativa))
}
