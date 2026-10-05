import {
  CONTEUDO_NOTICIA_MAX,
  noticiaCreateSchema,
  noticiaPublicacaoSchema,
  noticiaRascunhoSchema,
  noticiasPainelQuerySchema,
  noticiaUpdateSchema,
} from './schemas'

const CHAVE = 'atleticas/a/noticias/u/capa.jpg'

function campos(resultado: { error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return (resultado.error?.issues ?? []).map(({ path }) => path.join('.'))
}

describe('noticiaRascunhoSchema', () => {
  it('aceita só o título, com trim', () => {
    expect(noticiaRascunhoSchema.parse({ titulo: '  Seletiva de futsal ' })).toEqual({
      titulo: 'Seletiva de futsal',
    })
  })

  it('aceita conteúdo vazio e capa nula', () => {
    expect(
      noticiaRascunhoSchema.safeParse({ titulo: 'Seletiva', conteudo: '', imagemCapaKey: null })
        .success,
    ).toBe(true)
  })

  it.each(['ab', '  ab  ', 'x'.repeat(121)])('rejeita o título %j', (titulo) => {
    expect(campos(noticiaRascunhoSchema.safeParse({ titulo }))).toEqual(['titulo'])
  })

  it.each(['abc', 'x'.repeat(120)])('aceita o título com %#', (titulo) => {
    expect(noticiaRascunhoSchema.safeParse({ titulo }).success).toBe(true)
  })

  it('conteúdo até 10 000 caracteres', () => {
    const dentro = { titulo: 'Seletiva', conteudo: 'x'.repeat(CONTEUDO_NOTICIA_MAX) }
    const fora = { titulo: 'Seletiva', conteudo: 'x'.repeat(CONTEUDO_NOTICIA_MAX + 1) }
    expect(noticiaRascunhoSchema.safeParse(dentro).success).toBe(true)
    expect(campos(noticiaRascunhoSchema.safeParse(fora))).toEqual(['conteudo'])
  })

  it('aceita quebras de linha e tabulação, mas não outros caracteres de controle', () => {
    expect(
      noticiaRascunhoSchema.safeParse({ titulo: 'Seletiva', conteudo: 'a\r\n\tb' }).success,
    ).toBe(true)
    expect(
      campos(noticiaRascunhoSchema.safeParse({ titulo: 'Sele\u0000tiva', conteudo: 'a\u0007' })),
    ).toEqual(['titulo', 'conteudo'])
  })

  it('rejeita campos extras e chave vazia', () => {
    expect(
      noticiaRascunhoSchema.safeParse({ titulo: 'Seletiva', status: 'PUBLICADA' }).success,
    ).toBe(false)
    expect(
      campos(noticiaRascunhoSchema.safeParse({ titulo: 'Seletiva', imagemCapaKey: '' })),
    ).toEqual(['imagemCapaKey'])
  })
})

describe('noticiaPublicacaoSchema', () => {
  it('aceita título, conteúdo e capa', () => {
    expect(
      noticiaPublicacaoSchema.safeParse({
        titulo: 'Seletiva',
        conteudo: 'Texto',
        imagemCapaKey: CHAVE,
      }).success,
    ).toBe(true)
  })

  it.each([
    [{ conteudo: '   \n ', imagemCapaKey: CHAVE }, ['conteudo']],
    [{ conteudo: 'Texto', imagemCapaKey: null }, ['imagemCapaKey']],
    [{ conteudo: 'Texto' }, ['imagemCapaKey']],
  ])('exige conteúdo e capa: %j', (dados, esperado) => {
    expect(campos(noticiaPublicacaoSchema.safeParse({ titulo: 'Seletiva', ...dados }))).toEqual(
      esperado,
    )
  })
})

describe('noticiaCreateSchema', () => {
  it('aceita publicar booleano e rejeita outros valores', () => {
    expect(noticiaCreateSchema.safeParse({ titulo: 'Seletiva', publicar: true }).success).toBe(true)
    expect(campos(noticiaCreateSchema.safeParse({ titulo: 'Seletiva', publicar: 'sim' }))).toEqual([
      'publicar',
    ])
  })
})

describe('noticiaUpdateSchema', () => {
  it.each([
    { titulo: 'Seletiva' },
    { conteudo: '' },
    { imagemCapaKey: null },
    { imagemCapaKey: CHAVE },
  ])('aceita %j', (dados) => {
    expect(noticiaUpdateSchema.safeParse(dados).success).toBe(true)
  })

  it('rejeita corpo vazio, status e publicar', () => {
    expect(noticiaUpdateSchema.safeParse({}).success).toBe(false)
    expect(noticiaUpdateSchema.safeParse({ status: 'PUBLICADA' }).success).toBe(false)
    expect(noticiaUpdateSchema.safeParse({ titulo: 'Seletiva', publicar: true }).success).toBe(
      false,
    )
  })
})

describe('noticiasPainelQuerySchema', () => {
  it('aplica os padrões e descarta busca vazia', () => {
    expect(noticiasPainelQuerySchema.parse({ q: '  ' })).toEqual({ page: 1, limit: 20 })
    expect(noticiasPainelQuerySchema.parse({ status: 'RASCUNHO', q: ' seletiva ' })).toMatchObject({
      status: 'RASCUNHO',
      q: 'seletiva',
    })
  })

  it('rejeita status desconhecido, busca longa e campos extras', () => {
    expect(
      campos(noticiasPainelQuerySchema.safeParse({ status: 'EXCLUIDA', q: 'x'.repeat(101) })),
    ).toEqual(['status', 'q'])
    expect(noticiasPainelQuerySchema.safeParse({ autorId: '1' }).success).toBe(false)
  })
})
