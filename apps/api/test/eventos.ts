import type { INestApplicationContext } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

export interface EventoEmitido {
  nome: string
  payload: unknown
}

export interface EspiaoEventos {
  /** Eventos emitidos desde o último `espiarEventos`, na ordem. */
  emitidos(): EventoEmitido[]
  nomes(): string[]
}

/** Spy no `EventEmitter2` (convenções §9); chame no `beforeEach` para limpar a cada teste. */
export function espiarEventos(app: INestApplicationContext): EspiaoEventos {
  const spy = jest.spyOn(app.get(EventEmitter2), 'emit')
  spy.mockClear()
  const emitidos = (): EventoEmitido[] =>
    spy.mock.calls.map(([nome, payload]: unknown[]) => ({ nome: String(nome), payload }))
  return { emitidos, nomes: () => emitidos().map(({ nome }) => nome) }
}

/** Ouvintes `{ async: true }` rodam numa volta posterior do event loop. */
export function aguardarOuvintes(): Promise<void> {
  return new Promise((resolver) => setImmediate(resolver))
}
