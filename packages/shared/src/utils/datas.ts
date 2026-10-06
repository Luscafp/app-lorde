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
const INSTANTE_ISO =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/

function diaExiste(ano: string, mes: string, dia: string): boolean {
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)))
  return (
    data.getUTCFullYear() === Number(ano) &&
    data.getUTCMonth() === Number(mes) - 1 &&
    data.getUTCDate() === Number(dia)
  )
}

function isoValido(iso: string): boolean {
  const [, ano, mes, dia] = INSTANTE_ISO.exec(iso) ?? []
  return !!ano && !!mes && !!dia && diaExiste(ano, mes, dia)
}

function paraDate(instante: Instante): Date {
  const data = new Date(instante)
  if (Number.isNaN(data.getTime()) || (typeof instante === 'string' && !isoValido(instante))) {
    throw new Error(`Data inválida: ${String(instante)}`)
  }
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

/** 00:00 do dia local do instante, em UTC (`hojeLocal` no servidor). */
export function inicioDoDiaLocal(instante: Instante): Date {
  return localParaUtc(chaveDiaLocal(instante), '00:00')
}

/** Data (`"aaaa-mm-dd"`) e hora (`"HH:mm"`) no fuso padrão → instante UTC. */
export function localParaUtc(data: string, hora: string): Date {
  const [, ano, mes, dia] = DATA_LOCAL.exec(data) ?? []
  const [, h, min] = HORA_LOCAL.exec(hora) ?? []
  if (!ano || !mes || !dia || !h || !min) throw new Error(`Data ou hora inválida: ${data} ${hora}`)
  if (!diaExiste(ano, mes, dia)) throw new Error(`Data inválida: ${data}`)

  const relogio = Date.UTC(Number(ano), Number(mes) - 1, Number(dia), Number(h), Number(min))
  const estimativa = relogio - deslocamento(relogio)
  return new Date(relogio - deslocamento(estimativa))
}
