import { normalizarEspacos } from './texto'

describe('normalizarEspacos', () => {
  it('remove espaços nas pontas e colapsa os internos', () => {
    expect(normalizarEspacos('  Vôlei   de  Praia ')).toBe('Vôlei de Praia')
  })
})
