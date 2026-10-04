import { TAMANHO_MAXIMO_IMAGEM } from './constantes'
import { presignPedidoSchema } from './schemas'

const valido = { finalidade: 'PERFIL', contentType: 'image/jpeg', tamanhoBytes: 800_000 }

function erros(entrada: object): { campo: string; mensagem: string }[] {
  const resultado = presignPedidoSchema.safeParse(entrada)
  return (resultado.error?.issues ?? []).map(({ path, message }) => ({
    campo: path.join('.'),
    mensagem: message,
  }))
}

describe('presignPedidoSchema', () => {
  it.each(['PERFIL', 'NOTICIA', 'BANNER'])('aceita a finalidade %s', (finalidade) => {
    expect(presignPedidoSchema.safeParse({ ...valido, finalidade }).success).toBe(true)
  })

  it.each(['image/jpeg', 'image/png', 'image/webp'])('aceita %s', (contentType) => {
    expect(presignPedidoSchema.safeParse({ ...valido, contentType }).success).toBe(true)
  })

  it.each(['image/gif', 'application/pdf', 'text/html'])('rejeita %s', (contentType) => {
    expect(erros({ ...valido, contentType })).toEqual([
      { campo: 'contentType', mensagem: 'Envie uma imagem JPEG, PNG ou WebP.' },
    ])
  })

  it('aceita de 1 byte a 5 MB', () => {
    expect(presignPedidoSchema.safeParse({ ...valido, tamanhoBytes: 1 }).success).toBe(true)
    expect(
      presignPedidoSchema.safeParse({ ...valido, tamanhoBytes: TAMANHO_MAXIMO_IMAGEM }).success,
    ).toBe(true)
  })

  it('rejeita mais de 5 MB', () => {
    expect(erros({ ...valido, tamanhoBytes: 5_242_881 })).toEqual([
      { campo: 'tamanhoBytes', mensagem: 'A imagem deve ter no máximo 5 MB.' },
    ])
  })

  it.each([0, -1, 1.5, '800000'])('rejeita tamanhoBytes %p', (tamanhoBytes) => {
    expect(erros({ ...valido, tamanhoBytes }).map(({ campo }) => campo)).toEqual(['tamanhoBytes'])
  })

  it('rejeita finalidade desconhecida e campo extra', () => {
    expect(erros({ ...valido, finalidade: 'LOGO' })[0]?.campo).toBe('finalidade')
    expect(presignPedidoSchema.safeParse({ ...valido, key: 'x' }).success).toBe(false)
  })
})
