import { atleticaPublicaSchema } from './dtos'

const atletica = {
  id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
  nome: 'Atlética Exemplo',
  sigla: 'EXE',
  curso: 'Ciência da Computação',
  logoUrl: 'https://img.exemplo.com/logo.png',
  corPrimaria: '#E11D48',
  corSecundaria: '#2563eb',
  contatoEmail: 'diretoria@exemplo.com',
  contatoInstagram: '@exemplo',
  contatoWhatsapp: '+5598999999999',
}

describe('atleticaPublicaSchema', () => {
  it('aceita a resposta completa', () => {
    expect(atleticaPublicaSchema.parse(atletica)).toEqual(atletica)
  })

  it('aceita campos opcionais nulos', () => {
    const nulos = {
      ...atletica,
      sigla: null,
      curso: null,
      logoUrl: null,
      corPrimaria: null,
      corSecundaria: null,
      contatoEmail: null,
      contatoInstagram: null,
      contatoWhatsapp: null,
    }
    expect(atleticaPublicaSchema.safeParse(nulos).success).toBe(true)
  })

  it('exige todos os campos presentes', () => {
    const { contatoWhatsapp: _, ...semContato } = atletica
    expect(atleticaPublicaSchema.safeParse(semContato).success).toBe(false)
  })

  it('rejeita campos internos', () => {
    expect(atleticaPublicaSchema.safeParse({ ...atletica, usaAplicativo: true }).success).toBe(
      false,
    )
  })

  it.each(['E11D48', '#E11D4', 'red'])('rejeita a cor %s', (cor) => {
    expect(atleticaPublicaSchema.safeParse({ ...atletica, corPrimaria: cor }).success).toBe(false)
  })
})
