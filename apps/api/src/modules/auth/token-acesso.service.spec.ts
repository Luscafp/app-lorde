import { randomUUID } from 'node:crypto'
import { JwtService, type JwtSignOptions } from '@nestjs/jwt'
import { assinarToken } from '../../../test/fabricas/token'
import { codigoDoErro } from '../../../test/suporte/codigo-do-erro'
import { TokenAcessoService } from './token-acesso.service'

const SEGREDO = 's'.repeat(32)
const jwt = new JwtService({ secret: SEGREDO })
const servico = new TokenAcessoService(jwt)
const payload = { sub: randomUUID(), atl: randomUUID(), sid: randomUUID() }

function assinar(dados: object = payload, opcoes: JwtSignOptions = {}): string {
  return assinarToken(dados, { secret: SEGREDO, ...opcoes })
}

describe('TokenAcessoService.verificar', () => {
  it('devolve o payload de um token válido', () => {
    expect(servico.verificar(assinar())).toMatchObject({
      ...payload,
      iss: 'atletica-api',
      aud: 'atletica-app',
    })
  })

  it.each([
    ['assinatura com outro segredo', () => assinar(payload, { secret: 'o'.repeat(32) })],
    ['algoritmo HS384', () => assinar(payload, { algorithm: 'HS384' })],
    [
      'alg none',
      () => {
        const partes = assinar().split('.')
        const cabecalho = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')
        return `${cabecalho}.${partes[1]}.`
      },
    ],
    ['sem iss', () => assinar(payload, { issuer: undefined })],
    ['sem aud', () => assinar(payload, { audience: undefined })],
    ['iss errado', () => assinar(payload, { issuer: 'x' })],
    ['aud errado', () => assinar(payload, { audience: 'x' })],
    ['sem sid', () => assinar({ sub: payload.sub, atl: payload.atl })],
    ['atl fora do formato', () => assinar({ ...payload, atl: '1' })],
    ['claim extra (papel)', () => assinar({ ...payload, papel: 'ADMINISTRADOR' })],
    ['texto qualquer', () => 'abc'],
  ])('%s → 401 UNAUTHENTICATED', (_, gerar) => {
    expect(codigoDoErro(() => servico.verificar(gerar()))).toBe('401 UNAUTHENTICATED')
  })

  describe('exp com tolerância de 10 s', () => {
    const token = assinar()
    const { exp } = servico.verificar(token)
    const em = (segundos: number) => new Date((exp + segundos) * 1000)

    it('aceita até 10 s depois do exp', () => {
      expect(codigoDoErro(() => servico.verificar(token, em(10)))).toBeUndefined()
    })

    it('rejeita a partir de 11 s com TOKEN_EXPIRED', () => {
      expect(codigoDoErro(() => servico.verificar(token, em(11)))).toBe('401 TOKEN_EXPIRED')
      expect(codigoDoErro(() => servico.verificar(token, em(60)))).toBe('401 TOKEN_EXPIRED')
    })

    it('token vencido com assinatura inválida continua UNAUTHENTICATED', () => {
      const alheio = assinar(payload, { secret: 'o'.repeat(32) })
      expect(codigoDoErro(() => servico.verificar(alheio, em(60)))).toBe('401 UNAUTHENTICATED')
    })
  })
})
