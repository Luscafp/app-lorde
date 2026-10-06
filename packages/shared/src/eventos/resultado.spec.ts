import { calcularResultado, PLACAR_MAX, resultadoSchema } from './resultado'

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

describe('resultadoSchema', () => {
  const placar = { placarTime: 3, placarAdversario: 1 }

  it('aceita placar com e sem finalizar', () => {
    expect(resultadoSchema.parse(placar)).toEqual(placar)
    expect(resultadoSchema.parse({ ...placar, finalizar: true })).toEqual({
      ...placar,
      finalizar: true,
    })
  })

  it('aceita os limites 0 e 999', () => {
    expect(resultadoSchema.safeParse({ placarTime: 0, placarAdversario: PLACAR_MAX }).success).toBe(
      true,
    )
  })

  it.each([
    ['placarTime -1', { placarTime: -1 }, 'placarTime'],
    ['placarTime 1000', { placarTime: 1000 }, 'placarTime'],
    ['placarTime 2.5', { placarTime: 2.5 }, 'placarTime'],
    ['placarTime texto', { placarTime: '3' }, 'placarTime'],
    ['placarAdversario ausente', { placarAdversario: undefined }, 'placarAdversario'],
    ['finalizar não booleano', { finalizar: 'sim' }, 'finalizar'],
  ])('rejeita %s', (_caso, dados, campo) => {
    const resultado = resultadoSchema.safeParse({ ...placar, ...dados })
    expect(resultado.error?.issues.map(({ path }) => path.join('.'))).toEqual([campo])
  })

  it('rejeita resultado enviado pelo cliente (.strict())', () => {
    expect(resultadoSchema.safeParse({ ...placar, resultado: 'VITORIA' }).success).toBe(false)
  })
})
