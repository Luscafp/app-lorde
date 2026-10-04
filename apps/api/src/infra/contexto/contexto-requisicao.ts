import type { StoreContexto } from './contexto-atletica.service'

const contextos = new WeakMap<object, StoreContexto>()

/** Guarda o store CLS da requisição; o `JwtAuthGuard` (#7) o preenche depois, no mesmo objeto. */
export function vincularContexto(req: object, store: StoreContexto): void {
  contextos.set(req, store)
}

/** Lê o contexto fora do CLS (ex.: log de acesso, escrito no `finish` da resposta). */
export function contextoDaRequisicao(req: object): StoreContexto | undefined {
  return contextos.get(req)
}
