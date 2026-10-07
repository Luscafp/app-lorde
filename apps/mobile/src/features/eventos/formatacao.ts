import { StatusEvento, TipoEvento, type EventoDto } from '@atletica/shared'

export const ROTULO_STATUS: Record<StatusEvento, string> = {
  AGENDADO: 'Agendado',
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
}

export const ROTULO_TIPO: Record<TipoEvento, string> = { JOGO: 'Jogo', TREINO: 'Treino' }

/** Jogo: `"<time> × <atlética adversária>"`. */
export function tituloEvento({ tipo, time, timeAdversario }: EventoDto): string {
  if (tipo === TipoEvento.JOGO && timeAdversario) {
    return `${time.nome} × ${timeAdversario.atletica.nome}`
  }
  return `${ROTULO_TIPO[tipo]} · ${time.nome}`
}

export const rotuloAdversario = ({
  nome,
  atletica,
}: {
  nome: string
  atletica: { nome: string; sigla: string | null }
}) => `${nome} · ${atletica.sigla ?? atletica.nome}`
