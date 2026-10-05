import { ehIconeModalidade, ICONES_MODALIDADE } from './icones'
import {
  modalidadeCreateSchema,
  modalidadesQuerySchema,
  modalidadeUpdateSchema,
  normalizarNomeModalidade,
} from './schemas'

function campos(resultado: { error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return (resultado.error?.issues ?? []).map(({ path }) => path.join('.'))
}

describe('normalizarNomeModalidade', () => {
  it('remove espaços nas pontas e colapsa os internos', () => {
    expect(normalizarNomeModalidade('  Vôlei   de  Praia ')).toBe('Vôlei de Praia')
  })
})

describe('modalidadeCreateSchema', () => {
  it('normaliza o nome', () => {
    expect(modalidadeCreateSchema.parse({ nome: ' Handebol ', icone: 'handball' })).toEqual({
      nome: 'Handebol',
      icone: 'handball',
    })
  })

  it.each(['A', 'x'.repeat(41), '   ', '  a  '])('rejeita o nome %j', (nome) => {
    expect(campos(modalidadeCreateSchema.safeParse({ nome, icone: 'soccer' }))).toEqual(['nome'])
  })

  it('aceita 2 e 40 caracteres', () => {
    for (const nome of ['ab', 'x'.repeat(40)]) {
      expect(modalidadeCreateSchema.safeParse({ nome, icone: 'soccer' }).success).toBe(true)
    }
  })

  it('rejeita ícone fora do catálogo e campos ausentes', () => {
    expect(campos(modalidadeCreateSchema.safeParse({ nome: 'Futsal', icone: '⚽' }))).toEqual([
      'icone',
    ])
    expect(campos(modalidadeCreateSchema.safeParse({})).sort()).toEqual(['icone', 'nome'])
  })

  it('rejeita campos extras (ativa, id)', () => {
    const resultado = modalidadeCreateSchema.safeParse({
      nome: 'Futsal',
      icone: 'soccer',
      ativa: false,
    })
    expect(resultado.success).toBe(false)
  })
})

describe('modalidadeUpdateSchema', () => {
  it.each([{ nome: 'Futsal' }, { icone: 'soccer' }, { ativa: false }])('aceita %j', (dados) => {
    expect(modalidadeUpdateSchema.safeParse(dados).success).toBe(true)
  })

  it('rejeita corpo vazio e campo extra', () => {
    expect(modalidadeUpdateSchema.safeParse({}).success).toBe(false)
    expect(modalidadeUpdateSchema.safeParse({ ativa: true, id: 'x' }).success).toBe(false)
  })
})

describe('modalidadesQuerySchema', () => {
  it.each([
    [{}, false],
    [{ incluirInativas: 'false' }, false],
    [{ incluirInativas: 'true' }, true],
  ])('%j → incluirInativas %s', (query, esperado) => {
    expect(modalidadesQuerySchema.parse(query).incluirInativas).toBe(esperado)
  })

  it('rejeita valor que não é true/false', () => {
    expect(modalidadesQuerySchema.safeParse({ incluirInativas: '1' }).success).toBe(false)
  })
})

describe('ICONES_MODALIDADE', () => {
  it('não tem chaves repetidas e inclui o ícone genérico', () => {
    expect(new Set(ICONES_MODALIDADE).size).toBe(ICONES_MODALIDADE.length)
    expect(ehIconeModalidade('trophy')).toBe(true)
    expect(ehIconeModalidade('bola')).toBe(false)
  })
})
