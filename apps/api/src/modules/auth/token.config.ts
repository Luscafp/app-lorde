import type { JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt'
import { z } from 'zod'

/** Configuração do access token (convenções §5), compartilhada com a #10, que assina. */
export const ALGORITMO_TOKEN = 'HS256'
export const VALIDADE_TOKEN_ACESSO = 15 * 60
export const EMISSOR_TOKEN = 'atletica-api'
export const AUDIENCIA_TOKEN = 'atletica-app'
export const TOLERANCIA_RELOGIO = 10

export const OPCOES_ASSINATURA = {
  algorithm: ALGORITMO_TOKEN,
  expiresIn: VALIDADE_TOKEN_ACESSO,
  issuer: EMISSOR_TOKEN,
  audience: AUDIENCIA_TOKEN,
} as const satisfies JwtSignOptions

/** O `exp` é conferido à parte, depois do schema, para distinguir `TOKEN_EXPIRED`. */
export const OPCOES_VERIFICACAO = {
  algorithms: [ALGORITMO_TOKEN],
  issuer: EMISSOR_TOKEN,
  audience: AUDIENCIA_TOKEN,
  ignoreExpiration: true,
} as const satisfies JwtVerifyOptions

export const payloadAcessoSchema = z.strictObject({
  sub: z.uuid(),
  atl: z.uuid(),
  sid: z.uuid(),
  iat: z.number().int(),
  exp: z.number().int(),
  iss: z.literal(EMISSOR_TOKEN),
  aud: z.literal(AUDIENCIA_TOKEN),
})
