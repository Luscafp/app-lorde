import { StatusEvento, TipoEvento, type EventoDto } from '@atletica/shared'

export const ROTULO_STATUS: Record<StatusEvento, string> = {
  AGENDADO: 'Agendado',
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
}

export const ROTULO_TIPO: Record<TipoEvento, string> = { JOGO: 'Jogo', TREINO: 'Treino' }

/** Jogo: `"<time> × <atlética adversária>"` (épico #19, critério 2). */
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

/** Só dígitos, com as barras: `"10102026"` → `"10/10/2026"`. */
export function mascararData(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8)
  return [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4)].filter(Boolean).join('/')
}

/** `"1930"` → `"19:30"`. */
export function mascararHora(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 4)
  return [digitos.slice(0, 2), digitos.slice(2)].filter(Boolean).join(':')
}
