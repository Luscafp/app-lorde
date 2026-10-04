import { diferenca } from './diferenca'

describe('diferenca', () => {
  const d1 = new Date('2026-10-01T22:00:00.000Z')
  const d2 = new Date('2026-10-02T22:00:00.000Z')

  it('devolve só os campos alterados (critério 8)', () => {
    expect(diferenca({ local: 'A', inicio: d1 }, { local: 'A', inicio: d2 })).toEqual({
      antes: { inicio: d1 },
      depois: { inicio: d2 },
    })
  })

  it('objetos iguais → null', () => {
    expect(diferenca({ local: 'A', inicio: d1 }, { local: 'A', inicio: new Date(d1) })).toBeNull()
  })

  it('compara primitivos e null ↔ valor', () => {
    expect(diferenca({ placar: null, ativo: true }, { placar: 3, ativo: false })).toEqual({
      antes: { placar: null, ativo: true },
      depois: { placar: 3, ativo: false },
    })
  })

  it('campo ausente de um lado vira null', () => {
    expect(diferenca<Record<string, unknown>>({}, { observacoes: 'x' })).toEqual({
      antes: { observacoes: null },
      depois: { observacoes: 'x' },
    })
  })

  it('arrays por igualdade profunda', () => {
    expect(diferenca({ diasSemana: [1, 3] }, { diasSemana: [1, 3] })).toBeNull()
    expect(diferenca({ diasSemana: [1, 3] }, { diasSemana: [3, 1] })).toEqual({
      antes: { diasSemana: [1, 3] },
      depois: { diasSemana: [3, 1] },
    })
    expect(diferenca({ diasSemana: [1] }, { diasSemana: [1, 2] })).not.toBeNull()
  })

  it('objetos aninhados por igualdade profunda', () => {
    const antes = { placar: { nos: 1, eles: 0, em: d1 } }
    expect(diferenca(antes, { placar: { nos: 1, eles: 0, em: new Date(d1) } })).toBeNull()
    expect(diferenca(antes, { placar: { nos: 2, eles: 0, em: d1 } })).toEqual({
      antes,
      depois: { placar: { nos: 2, eles: 0, em: d1 } },
    })
  })

  it('data × não data é diferente', () => {
    expect(diferenca<{ fim: unknown }>({ fim: d1 }, { fim: d1.toISOString() })).not.toBeNull()
  })

  it('ignora criadoEm e atualizadoEm', () => {
    expect(
      diferenca(
        { local: 'A', criadoEm: d1, atualizadoEm: d1 },
        { local: 'A', criadoEm: d2, atualizadoEm: d2 },
      ),
    ).toBeNull()
  })

  it('respeita a lista branca', () => {
    const antes = { local: 'A', status: 'AGENDADO', criadoPorId: 'u1' }
    const depois = { local: 'B', status: 'CANCELADO', criadoPorId: 'u2' }
    expect(diferenca(antes, depois, ['local'])).toEqual({
      antes: { local: 'A' },
      depois: { local: 'B' },
    })
    expect(diferenca(antes, { ...antes, criadoPorId: 'u2' }, ['local', 'status'])).toBeNull()
  })
})
