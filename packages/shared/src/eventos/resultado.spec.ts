import { calcularResultado } from './resultado'

describe('calcularResultado', () => {
  it.each([
    [3, 1, 'VITORIA'],
    [1, 1, 'EMPATE'],
    [0, 2, 'DERROTA'],
    [0, 0, 'EMPATE'],
    [999, 998, 'VITORIA'],
  ])('%i × %i → %s', (placarTime, placarAdversario, esperado) => {
    expect(calcularResultado(placarTime, placarAdversario)).toBe(esperado)
  })
})
