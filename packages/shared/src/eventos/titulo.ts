import type { EventoDto } from './dtos'

/** Jogo: `"<time> × <atlética adversária>"`; Treino: o nome do time (épico #19, critério 2). */
export function tituloDoEvento({
  time,
  timeAdversario,
}: Pick<EventoDto, 'time' | 'timeAdversario'>) {
  return timeAdversario ? `${time.nome} × ${timeAdversario.atletica.nome}` : time.nome
}
