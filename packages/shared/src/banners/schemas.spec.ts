import {
  bannerCreateSchema,
  bannerFormSchema,
  bannersOrdemSchema,
  bannerUpdateSchema,
  LINK_BANNER_MAX,
  MENSAGEM_LINK_HTTPS,
} from './schemas'

const CHAVE = 'atleticas/a/banners/u/imagem.webp'
const ID = 'b7e1c0de-5a4f-4e2d-8b6a-9c0d1e2f3a4b'

function erros(resultado: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return (resultado.error?.issues ?? []).map(({ path, message }) => [path.join('.'), message])
}

describe('bannerCreateSchema', () => {
  it('aceita título e imagem, com trim e sem link', () => {
    expect(bannerCreateSchema.parse({ titulo: '  Inscrições  ', imagemKey: CHAVE })).toEqual({
      titulo: 'Inscrições',
      imagemKey: CHAVE,
    })
  })

  it('link vazio vira null', () => {
    expect(bannerCreateSchema.parse({ titulo: 'JUBS', imagemKey: CHAVE, link: '  ' }).link).toBe(
      null,
    )
  })

  it.each(['ab', 'x'.repeat(81)])('rejeita o título %j', (titulo) => {
    expect(erros(bannerCreateSchema.safeParse({ titulo, imagemKey: CHAVE }))[0]?.[0]).toBe('titulo')
  })

  it('exige a imagem', () => {
    expect(erros(bannerCreateSchema.safeParse({ titulo: 'JUBS' }))[0]?.[0]).toBe('imagemKey')
  })

  it('rejeita campo extra', () => {
    expect(
      bannerCreateSchema.safeParse({ titulo: 'JUBS', imagemKey: CHAVE, ordem: 3 }).success,
    ).toBe(false)
  })

  it.each([
    'https://exemplo.com',
    'https://forms.gle/abc?x=1#y',
    `https://exemplo.com/${'x'.repeat(LINK_BANNER_MAX - 20)}`,
  ])('aceita o link %#', (link) => {
    expect(bannerCreateSchema.safeParse({ titulo: 'JUBS', imagemKey: CHAVE, link }).success).toBe(
      true,
    )
  })

  it.each(['http://exemplo.com', 'javascript:alert(1)', 'exemplo.com', 'HTTPS://exemplo.com'])(
    'link %j → mensagem de HTTPS',
    (link) => {
      expect(
        erros(bannerCreateSchema.safeParse({ titulo: 'JUBS', imagemKey: CHAVE, link })),
      ).toEqual([['link', MENSAGEM_LINK_HTTPS]])
    },
  )

  it.each(['https://user:senha@exemplo.com', 'https://localhost', 'https://exe mplo.com'])(
    'rejeita o link %j',
    (link) => {
      expect(
        erros(bannerCreateSchema.safeParse({ titulo: 'JUBS', imagemKey: CHAVE, link })),
      ).toEqual([['link', 'Link inválido.']])
    },
  )

  it('rejeita link maior que o limite', () => {
    const link = `https://exemplo.com/${'x'.repeat(LINK_BANNER_MAX)}`
    expect(
      erros(bannerCreateSchema.safeParse({ titulo: 'JUBS', imagemKey: CHAVE, link }))[0]?.[0],
    ).toBe('link')
  })
})

describe('bannerUpdateSchema', () => {
  it('exige ao menos um campo', () => {
    expect(bannerUpdateSchema.safeParse({}).success).toBe(false)
  })

  it('aceita só ativo', () => {
    expect(bannerUpdateSchema.parse({ ativo: false })).toEqual({ ativo: false })
  })

  it('null ou vazio removem o link', () => {
    expect(bannerUpdateSchema.parse({ link: null })).toEqual({ link: null })
    expect(bannerUpdateSchema.parse({ link: '' })).toEqual({ link: null })
  })
})

describe('bannersOrdemSchema', () => {
  it('aceita uuids', () => {
    expect(bannersOrdemSchema.safeParse({ ids: [ID] }).success).toBe(true)
  })

  it.each([[[]], [['abc']], [Array.from({ length: 101 }, () => ID)]])('rejeita %#', (ids) => {
    expect(bannersOrdemSchema.safeParse({ ids }).success).toBe(false)
  })
})

describe('bannerFormSchema', () => {
  it('imagem opcional (edição) e link vazio', () => {
    expect(bannerFormSchema.parse({ titulo: 'JUBS', link: '', ativo: true })).toEqual({
      titulo: 'JUBS',
      link: null,
      ativo: true,
    })
  })
})
