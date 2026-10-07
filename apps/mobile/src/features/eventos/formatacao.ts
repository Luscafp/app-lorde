import {
  chaveDiaLocal,
  diaDaSemana,
  formatarData,
  formatarDataHora,
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

/** `"seg, 05/10/2026 18:30"` no fuso padrão. */
export function dataHoraComSemana(instante: Instante): string {
  return `${DIAS_SEMANA[diaDaSemana(chaveDiaLocal(instante))]}, ${formatarDataHora(instante)}`
}

/** `"1 treino agendado"` / `"3 treinos agendados"`. */
export function contarTreinos(total: number, adjetivo = ''): string {
  const plural = total === 1 ? '' : 's'
  return `${total} treino${plural}${adjetivo && ` ${adjetivo}${plural}`}`
}

export const rotuloAdversario = ({
  nome,
  atletica,
}: {
  nome: string
  atletica: AtleticaAdversaria
}) => `${nome} · ${siglaOuNome(atletica)}`
