import {
  chaveDiaLocal,
  formatarData,
  localParaUtc,
  TipoEvento,
  type EventoResumoDto,
  type Instante,
} from '@atletica/shared'

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const
const UM_DIA_MS = 86_400_000

export function tituloEvento({
  tipo,
  time,
  timeAdversario,
}: Pick<EventoResumoDto, 'tipo' | 'time' | 'timeAdversario'>): string {
  if (tipo === TipoEvento.TREINO) return `Treino — ${time.nome}`
  return `${time.nome} × ${timeAdversario?.atletica.nome ?? '—'}`
}

/** `dia` no formato de `chaveDiaLocal`: "Hoje", "Amanhã" ou "qua, 14/10". */
export function rotuloDia(dia: string, agora: Instante = Date.now()): string {
  const hoje = chaveDiaLocal(agora)
  if (dia === hoje) return 'Hoje'
  if (dia === chaveDiaLocal(localParaUtc(hoje, '12:00').getTime() + UM_DIA_MS)) return 'Amanhã'
  const meioDia = localParaUtc(dia, '12:00')
  return `${DIAS_SEMANA[meioDia.getUTCDay()]}, ${formatarData(meioDia).slice(0, 5)}`
}
