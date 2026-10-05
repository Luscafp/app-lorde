import { timeCreateSchema, timesQuerySchema, timeUpdateSchema } from './schemas'

const MODALIDADE = '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11'

function campos(resultado: { error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return (resultado.error?.issues ?? []).map(({ path }) => path.join('.'))
}

describe('timeCreateSchema', () => {
  it('normaliza o nome e aceita adversária nula ou ausente', () => {
    expect(
      timeCreateSchema.parse({ nome: '  Futsal   Masculino ', modalidadeId: MODALIDADE }),
    ).toEqual({ nome: 'Futsal Masculino', modalidadeId: MODALIDADE })
    expect(
      timeCreateSchema.safeParse({
        nome: 'Futsal',
        modalidadeId: MODALIDADE,
        atleticaAdversariaId: null,
      }).success,
    ).toBe(true)
  })

  it.each(['A', 'x'.repeat(61), '   '])('rejeita o nome %j', (nome) => {
    expect(campos(timeCreateSchema.safeParse({ nome, modalidadeId: MODALIDADE }))).toEqual(['nome'])
  })

  it('rejeita ids inválidos e campos extras', () => {
    expect(
      campos(
        timeCreateSchema.safeParse({
          nome: 'Futsal',
          modalidadeId: 'x',
          atleticaAdversariaId: 'y',
        }),
      ),
    ).toEqual(['modalidadeId', 'atleticaAdversariaId'])
    expect(
      timeCreateSchema.safeParse({ nome: 'Futsal', modalidadeId: MODALIDADE, ativo: false })
        .success,
    ).toBe(false)
  })
})

describe('timeUpdateSchema', () => {
  it.each([{ nome: 'Futsal' }, { modalidadeId: MODALIDADE }, { ativo: false }])(
    'aceita %j',
    (dados) => {
      expect(timeUpdateSchema.safeParse(dados).success).toBe(true)
    },
  )

  it('rejeita corpo vazio, troca de atlética e capitão', () => {
    expect(timeUpdateSchema.safeParse({}).success).toBe(false)
    expect(timeUpdateSchema.safeParse({ atleticaAdversariaId: MODALIDADE }).success).toBe(false)
    expect(timeUpdateSchema.safeParse({ ativo: true, capitaoId: MODALIDADE }).success).toBe(false)
  })
})

describe('timesQuerySchema', () => {
  it('aplica os padrões', () => {
    expect(timesQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      escopo: 'PROPRIOS',
      incluirInativos: false,
    })
  })

  it('converte filtros e descarta busca vazia', () => {
    expect(
      timesQuerySchema.parse({ escopo: 'ADVERSARIOS', incluirInativos: 'true', q: '  ' }),
    ).toMatchObject({ escopo: 'ADVERSARIOS', incluirInativos: true, q: undefined })
    expect(timesQuerySchema.parse({ q: ' fut ' }).q).toBe('fut')
  })

  it('rejeita escopo, ids e campos desconhecidos', () => {
    expect(
      campos(timesQuerySchema.safeParse({ escopo: 'TODOS', modalidadeId: '1' })).sort(),
    ).toEqual(['escopo', 'modalidadeId'])
    expect(timesQuerySchema.safeParse({ ativo: 'true' }).success).toBe(false)
  })
})
