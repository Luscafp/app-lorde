import { RequestMethod } from '@nestjs/common'
import type { Params } from 'nestjs-pino'
import type { Env } from '../../config/env.schema'

/** JSON em homologação/produção; `pino-pretty` em desenvolvimento. requestId e redaction: #48. */
export function criarConfigLogger(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): Params {
  const legivel = env.NODE_ENV === 'development'
  return {
    // Sintaxe do path-to-regexp v8 (Express 5); o padrão '*' gera aviso.
    forRoutes: [{ path: '{*splat}', method: RequestMethod.ALL }],
    pinoHttp: {
      level: env.LOG_LEVEL,
      // O access token nunca vai para o log (#7 §10); a redaction completa é da #48.
      redact: ['req.headers.authorization'],
      ...(legivel && {
        transport: {
          target: 'pino-pretty',
          options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
        },
      }),
    },
  }
}
