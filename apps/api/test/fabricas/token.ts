import { JwtService, type JwtSignOptions } from '@nestjs/jwt'
import { OPCOES_ASSINATURA } from '../../src/modules/auth/token.config'

/** Assina com a configuração da API; opção `undefined` é removida (ex.: `{ issuer: undefined }`). */
export function assinarToken(payload: object, opcoes: JwtSignOptions = {}): string {
  const combinadas = { ...OPCOES_ASSINATURA, secret: process.env.JWT_ACCESS_SECRET, ...opcoes }
  return new JwtService().sign(
    payload,
    Object.fromEntries(Object.entries(combinadas).filter(([, valor]) => valor !== undefined)),
  )
}
