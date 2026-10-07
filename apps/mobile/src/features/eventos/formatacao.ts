import {
  chaveDiaLocal,
  formatarData,
  localParaUtc,
  Resultado,
  TipoEvento,
  type EventoResumoDto,
  type Instante,
} from '@atletica/shared'
import { RESULTADO, siglaOuNome, type AtleticaAdversaria } from './rotulos'

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

export const rotuloAdversario = ({
  nome,
  atletica,
}: {
  nome: string
  atletica: AtleticaAdversaria
}) => `${nome} · ${siglaOuNome(atletica)}`

/** RNF20: "Vitória da {sigla}", com a sigla (ou o nome) da atlética dona. */
export function rotuloResultado(resultado: Resultado, atletica: string): string {
  if (resultado === Resultado.EMPATE) return RESULTADO[resultado].rotulo
  return `${RESULTADO[resultado].rotulo} da ${atletica}`
}
