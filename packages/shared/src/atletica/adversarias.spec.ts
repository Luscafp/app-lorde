import {
  atleticaAdversariaSchema,
  atleticaAdversariaUpdateSchema,
  atleticasAdversariasQuerySchema,
} from './adversarias'

describe('atleticaAdversariaSchema', () => {
  it('normaliza nome, sigla em maiúsculas e opcionais vazios como null', () => {
    expect(
      atleticaAdversariaSchema.parse({ nome: ' Atlética  Fênix ', sigla: ' fnx ', curso: '  ' }),
    ).toEqual({
      nome: 'Atlética Fênix',
      sigla: 'FNX',
      curso: null,
    })
    expect(atleticaAdversariaSchema.parse({ nome: 'Fênix' })).toEqual({
      nome: 'Fênix',
      sigla: null,
      curso: null,
    })
  })

  it.each([
    [{ nome: 'F' }, 'nome'],
    [{ nome: 'x'.repeat(81) }, 'nome'],
    [{ nome: 'Fênix', sigla: 'x'.repeat(11) }, 'sigla'],
    [{ nome: 'Fênix', curso: 'x'.repeat(81) }, 'curso'],
  ])('rejeita %j', (dados, campo) => {
    const resultado = atleticaAdversariaSchema.safeParse(dados)
    expect(resultado.error?.issues.map(({ path }) => path.join('.'))).toEqual([campo])
  })

  it('não aceita usaAplicativo no corpo', () => {
    expect(atleticaAdversariaSchema.safeParse({ nome: 'Fênix', usaAplicativo: true }).success).toBe(
      false,
    )
  })
})

describe('atleticaAdversariaUpdateSchema', () => {
  it('é parcial, permite limpar opcionais e exige ao menos um campo', () => {
    expect(atleticaAdversariaUpdateSchema.parse({ sigla: null })).toEqual({ sigla: null })
    expect(atleticaAdversariaUpdateSchema.parse({ curso: 'Direito' })).toEqual({ curso: 'Direito' })
    expect(atleticaAdversariaUpdateSchema.safeParse({}).success).toBe(false)
  })
})

describe('atleticasAdversariasQuerySchema', () => {
  it('aplica a paginação e descarta busca vazia', () => {
    expect(atleticasAdversariasQuerySchema.parse({ q: ' ' })).toEqual({
      page: 1,
      limit: 20,
      q: undefined,
    })
  })
})
