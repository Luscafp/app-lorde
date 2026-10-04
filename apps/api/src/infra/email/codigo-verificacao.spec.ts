import { createHmac, randomInt } from 'node:crypto'
import type { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import { CodigoVerificacaoService } from './codigo-verificacao'

jest.mock('node:crypto', () => {
  const real = jest.requireActual<typeof import('node:crypto')>('node:crypto')
  return { ...real, randomInt: jest.fn(real.randomInt) }
})

const PEPPER = 'pepper-de-teste-com-pelo-menos-32-caracteres'
const servico = new CodigoVerificacaoService({
  get: () => PEPPER,
} as unknown as ConfigService<Env, true>)

describe('gerarCodigo', () => {
  afterEach(() => jest.mocked(randomInt).mockClear())

  it('preenche com zeros à esquerda (randomInt 48213 → "048213")', () => {
    jest.mocked(randomInt).mockReturnValueOnce(48213 as never)
    expect(servico.gerarCodigo()).toBe('048213')
    expect(randomInt).toHaveBeenCalledWith(0, 1_000_000)
  })

  it.each([
    [0, '000000'],
    [999_999, '999999'],
  ])('randomInt %p → %p', (sorteado, esperado) => {
    jest.mocked(randomInt).mockReturnValueOnce(sorteado as never)
    expect(servico.gerarCodigo()).toBe(esperado)
  })

  it('gera sempre 6 dígitos', () => {
    for (let i = 0; i < 200; i++) expect(servico.gerarCodigo()).toMatch(/^\d{6}$/)
  })
})

describe('CodigoVerificacaoService', () => {
  const usuarioId = '7a1c2b3d-0000-4000-8000-000000000001'

  it('hashCodigo = HMAC-SHA256(CODIGO_PEPPER, usuarioId:codigo) em hex', () => {
    const esperado = createHmac('sha256', PEPPER).update(`${usuarioId}:048213`).digest('hex')
    expect(servico.hashCodigo(usuarioId, '048213')).toBe(esperado)
    expect(servico.hashCodigo(usuarioId, '048213')).not.toContain('048213')
  })

  it('codigoConfere aceita o código certo do mesmo usuário', () => {
    const hash = servico.hashCodigo(usuarioId, '048213')
    expect(servico.codigoConfere(hash, usuarioId, '048213')).toBe(true)
  })

  it('codigoConfere recusa outro código ou outro usuário', () => {
    const hash = servico.hashCodigo(usuarioId, '048213')
    expect(servico.codigoConfere(hash, usuarioId, '048214')).toBe(false)
    expect(servico.codigoConfere(hash, '7a1c2b3d-0000-4000-8000-000000000002', '048213')).toBe(
      false,
    )
  })

  it('codigoConfere recusa hash gerado com outro pepper', () => {
    const outro = createHmac('sha256', 'x'.repeat(32)).update(`${usuarioId}:048213`).digest('hex')
    expect(servico.codigoConfere(outro, usuarioId, '048213')).toBe(false)
  })

  it('codigoConfere recusa hash malformado sem lançar', () => {
    expect(servico.codigoConfere('', usuarioId, '048213')).toBe(false)
    expect(servico.codigoConfere('abc', usuarioId, '048213')).toBe(false)
  })
})
