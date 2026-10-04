import type { Request } from 'express'

/**
 * Padrão da rota (`/api/v1/eventos/:id`), nunca a URL com IDs; `undefined` se nenhuma casou
 * (o curinga `{*splat}` dos middlewares não é rota).
 */
export function rotaDaRequisicao(req: Request): string | undefined {
  const caminho: unknown = (req.route as { path?: unknown } | undefined)?.path
  if (typeof caminho !== 'string' || caminho.includes('*')) return undefined
  return `${req.baseUrl}${caminho}`
}
