import { randomUUID } from 'node:crypto'
import { JwtService, type JwtSignOptions } from '@nestjs/jwt'
import { ErroNegocio } from '../../common/erros/erro-negocio'
import { OPCOES_ASSINATURA } from './token.config'
import { TokenAcessoService } from './token-acesso.service'

const SEGREDO = 's'.repeat(32)
const jwt = new JwtService({ secret: SEGREDO })
const servico = new TokenAcessoService(jwt)
const payload = { sub: randomUUID(), atl: randomUUID(), sid: randomUUID() }

/** Valor `undefined` em `opcoes` remove a opção (o jsonwebtoken rejeita `undefined`). */
function assinar(dados: object = payload, opcoes: JwtSignOptions = {}): string {
  const combinadas = Object.entries({ ...OPCOES_ASSINATURA, ...opcoes })
  return jwt.sign(dados, Object.fromEntries(combinadas.filter(([, valor]) => valor !== undefined)))
}

function codigoDoErro(acao: () => unknown): string | undefined {
  try {
    acao()
  } catch (erro) {
    if (erro instanceof ErroNegocio) return `${erro.statusCode} ${erro.code}`
    throw erro
  }
  return undefined
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
    ['texto qualquer', () => 'abc'],
  ])('%s → 401 UNAUTHENTICATED', (_, gerar) => {
    expect(codigoDoErro(() => servico.verificar(gerar()))).toBe('401 UNAUTHENTICATED')
  })

  describe('exp com tolerância de 10 s', () => {
    const token = assinar()
    const { exp } = servico.verificar(token)
    const em = (segundos: number) => new Date((exp + segundos) * 1000)

    it('aceita até 9 s depois do exp', () => {
      expect(codigoDoErro(() => servico.verificar(token, em(9)))).toBeUndefined()
    })

    it('rejeita a partir de 10 s com TOKEN_EXPIRED', () => {
      expect(codigoDoErro(() => servico.verificar(token, em(10)))).toBe('401 TOKEN_EXPIRED')
      expect(codigoDoErro(() => servico.verificar(token, em(60)))).toBe('401 TOKEN_EXPIRED')
    })

    it('token vencido com assinatura inválida continua UNAUTHENTICATED', () => {
      const alheio = assinar(payload, { secret: 'o'.repeat(32) })
      expect(codigoDoErro(() => servico.verificar(alheio, em(60)))).toBe('401 UNAUTHENTICATED')
    })
  })
})
