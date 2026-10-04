import type { JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt'
import { z } from 'zod'

/** Configuração do access token (convenções §5), compartilhada com a #10, que assina. */
export const ALGORITMO_TOKEN = 'HS256'
export const ACCESS_TOKEN_TTL = 15 * 60
export const EMISSOR_TOKEN = 'atletica-api'
export const PUBLICO_TOKEN = 'atletica-app'
export const TOLERANCIA_RELOGIO = 10

export const OPCOES_ASSINATURA = {
  algorithm: ALGORITMO_TOKEN,
  expiresIn: ACCESS_TOKEN_TTL,
  issuer: EMISSOR_TOKEN,
  audience: PUBLICO_TOKEN,
} as const satisfies JwtSignOptions

/** O `exp` é conferido à parte, depois do schema, para distinguir `TOKEN_EXPIRED`. */
export const OPCOES_VERIFICACAO = {
  algorithms: [ALGORITMO_TOKEN],
  issuer: EMISSOR_TOKEN,
  audience: PUBLICO_TOKEN,
  ignoreExpiration: true,
} as const satisfies JwtVerifyOptions

export const payloadAcessoSchema = z.object({
  sub: z.uuid(),
  atl: z.uuid(),
  sid: z.uuid(),
  iat: z.number().int(),
  exp: z.number().int(),
  iss: z.literal(EMISSOR_TOKEN),
  aud: z.literal(PUBLICO_TOKEN),
})
