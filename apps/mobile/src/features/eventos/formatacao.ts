import { chaveDiaLocal, TipoEvento, type EventoResumoDto, type Instante } from '@atletica/shared'

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

export function tituloEvento({
  tipo,
  time,
  timeAdversario,
}: Pick<EventoResumoDto, 'tipo' | 'time' | 'timeAdversario'>): string {
  if (tipo === TipoEvento.TREINO) return `Treino — ${time.nome}`
  return `${time.nome} × ${timeAdversario?.atletica.nome ?? '—'}`
}

function diaUtc(dia: string, deslocamento = 0): Date {
  const [ano = 0, mes = 1, numero = 1] = dia.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, numero + deslocamento))
}

/** `dia` no formato de `chaveDiaLocal`: "Hoje", "Amanhã" ou "qua, 14/10". */
export function rotuloDia(dia: string, agora: Instante = Date.now()): string {
  const hoje = chaveDiaLocal(agora)
  if (dia === hoje) return 'Hoje'
  if (dia === diaUtc(hoje, 1).toISOString().slice(0, 10)) return 'Amanhã'
  const [, mes, numero] = dia.split('-')
  return `${DIAS_SEMANA[diaUtc(dia).getUTCDay()]}, ${numero}/${mes}`
}
