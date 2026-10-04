import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

export const CABECALHO_REQUEST_ID = 'X-Request-Id'

export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Só aceita o valor do cliente se for UUID v4 (evita injeção em logs); senão gera um. */
export function resolverRequestId(recebido: unknown): string {
  return typeof recebido === 'string' && UUID_V4.test(recebido) ? recebido : randomUUID()
}

/** Primeiro middleware da aplicação: o pino-http e o CLS leem `req.id`. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.id = resolverRequestId(req.headers['x-request-id'])
  res.setHeader(CABECALHO_REQUEST_ID, req.id)
  next()
}
