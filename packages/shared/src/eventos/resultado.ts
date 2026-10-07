import { Resultado } from '../enums/evento'

/** Do ponto de vista da atlética dona do evento (RN17). */
export function calcularResultado(placarTime: number, placarAdversario: number): Resultado {
  if (placarTime > placarAdversario) return Resultado.VITORIA
  if (placarTime < placarAdversario) return Resultado.DERROTA
  return Resultado.EMPATE
}
