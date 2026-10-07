import {
  chaveDiaLocal,
  formatarData,
  formatarHora,
  localParaUtc,
  TipoEvento,
  type EventoResumoDto,
  type Instante,
} from '@atletica/shared'
import { siglaOuNome, type AtleticaAdversaria } from './rotulos'

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

/** `"Qui · 01/10/2026 · 19:00"` no fuso padrão. */
export function rotuloInicio(inicio: Instante): string {
  const sigla = DIAS_SEMANA[localParaUtc(chaveDiaLocal(inicio), '12:00').getUTCDay()] ?? ''
  const dia = sigla.charAt(0).toUpperCase() + sigla.slice(1)
  return `${dia} · ${formatarData(inicio)} · ${formatarHora(inicio)}`
}

export const rotuloAdversario = ({
  nome,
  atletica,
}: {
  nome: string
  atletica: AtleticaAdversaria
}) => `${nome} · ${siglaOuNome(atletica)}`
