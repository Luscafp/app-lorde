import { noticiaCreateSchema, noticiaUpdateSchema, listarNoticiasQuerySchema } from './schemas'
import { normalizarNomeTag, semTagsRepetidas, tagsNoticiaSchema, tagsQuerySchema } from './tags'

function campos(resultado: { error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return (resultado.error?.issues ?? []).map(({ path }) => path.join('.'))
}

describe('normalizarNomeTag', () => {
  it.each([
    ['  Vôlei   Feminino ', 'volei feminino'],
    ['FUTSAL', 'futsal'],
    ['Pré-Seletiva', 'pre-seletiva'],
    ['Ação', 'acao'],
  ])('%j → %j', (nome, esperado) => {
    expect(normalizarNomeTag(nome)).toBe(esperado)
  })
})

describe('semTagsRepetidas', () => {
  it('unifica caixa e acento, mantendo a primeira grafia', () => {
    expect(semTagsRepetidas(['Vôlei', 'volei', 'Futsal', 'FUTSAL'])).toEqual(['Vôlei', 'Futsal'])
  })
})

describe('tagsNoticiaSchema', () => {
  it('apara, colapsa espaços e deduplica', () => {
    expect(tagsNoticiaSchema.parse(['  Vôlei   Feminino ', 'volei feminino', 'Futsal'])).toEqual([
      'Vôlei Feminino',
      'Futsal',
    ])
  })

  it('aceita lista vazia', () => {
    expect(tagsNoticiaSchema.parse([])).toEqual([])
  })

  it('rejeita mais de 5 tags', () => {
    const seis = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff']
    expect(campos(tagsNoticiaSchema.safeParse(seis))).toEqual([''])
  })

  it.each(['a', ' a ', 'x'.repeat(31), '<b>', 'Futsal!', 'Vôlei 🏐', 'a_b'])(
    'rejeita %j',
    (tag) => {
      expect(campos(tagsNoticiaSchema.safeParse(['Futsal', tag]))).toEqual(['1'])
    },
  )

  it.each(['ab', 'x'.repeat(30), 'Sub-20', 'Vôlei Feminino', 'Ação 2026'])('aceita %j', (tag) => {
    expect(tagsNoticiaSchema.safeParse([tag]).success).toBe(true)
  })
})

describe('tags na notícia', () => {
  it('criação aceita tags e aponta o erro em tags.N', () => {
    expect(noticiaCreateSchema.parse({ titulo: 'Seletiva', tags: ['Futsal'] }).tags).toEqual([
      'Futsal',
    ])
    expect(campos(noticiaCreateSchema.safeParse({ titulo: 'Seletiva', tags: ['<b>'] }))).toEqual([
      'tags.0',
    ])
  })

  it('alteração só com tags, inclusive vazia', () => {
    expect(noticiaUpdateSchema.parse({ tags: [] })).toEqual({ tags: [] })
    expect(noticiaUpdateSchema.parse({ tags: ['Resultados'] })).toEqual({ tags: ['Resultados'] })
  })
})

describe('listarNoticiasQuerySchema', () => {
  it('aceita tagId UUID e rejeita outros valores', () => {
    const tagId = 'b7e1c0de-5a4f-4e2d-8b6a-9c0d1e2f3a4b'
    expect(listarNoticiasQuerySchema.parse({ tagId })).toMatchObject({ tagId })
    expect(campos(listarNoticiasQuerySchema.safeParse({ tagId: '1' }))).toEqual(['tagId'])
  })
})

describe('tagsQuerySchema', () => {
  it('emUso é true por padrão e busca vazia some', () => {
    expect(tagsQuerySchema.parse({ q: '  ' })).toEqual({ page: 1, limit: 20, emUso: true })
    expect(tagsQuerySchema.parse({ emUso: 'false', q: ' cal ' })).toMatchObject({
      emUso: false,
      q: 'cal',
    })
  })

  it('rejeita emUso inválido, limite acima de 50 e campos extras', () => {
    expect(campos(tagsQuerySchema.safeParse({ emUso: 'sim', limit: '51' }))).toEqual([
      'limit',
      'emUso',
    ])
    expect(tagsQuerySchema.safeParse({ nome: 'x' }).success).toBe(false)
  })
})
