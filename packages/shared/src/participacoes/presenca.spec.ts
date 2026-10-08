import { StatusEvento } from '../enums/evento'
import { aceitaPresenca, RespostaPresenca, respostaPresenca } from './presenca'

describe('aceitaPresenca', () => {
  it.each([
    [StatusEvento.AGENDADO, false],
    [StatusEvento.EM_ANDAMENTO, true],
    [StatusEvento.FINALIZADO, true],
    [StatusEvento.CANCELADO, false],
  ])('%s → %s', (status, esperado) => {
    expect(aceitaPresenca(status)).toBe(esperado)
  })
})

describe('respostaPresenca', () => {
  it.each([
    [true, RespostaPresenca.CONFIRMOU],
    [false, RespostaPresenca.RECUSOU],
    [null, RespostaPresenca.SEM_RESPOSTA],
    [undefined, RespostaPresenca.SEM_RESPOSTA],
  ])('%s → %s', (confirmado, esperado) => {
    expect(respostaPresenca(confirmado)).toBe(esperado)
  })
})
