import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Sentry from '@sentry/react-native'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import {
  defaultShouldDehydrateQuery,
  type DehydratedState,
  type Query,
} from '@tanstack/react-query'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import * as Application from 'expo-application'
import { chaves } from '@/infra/query/chaves'
import { useSessao } from '@/infra/sessao/store'

/** Mude ao alterar o formato de algum dado persistido: o cache antigo é descartado. */
export const CACHE_SCHEMA_VERSION = 1
export const MAX_AGE = 7 * 24 * 60 * 60_000
export const PAGINAS_PERSISTIDAS = 2
export const BUSTER = `${Application.nativeApplicationVersion ?? '0'}-${CACHE_SCHEMA_VERSION}`

export const metaPersistida = { persistir: true } as const

/** Convenções §10.4: o `gcTime` não pode ser menor que o `maxAge`, senão a query some antes de salvar. */
export const persistida = { meta: metaPersistida, gcTime: MAX_AGE } as const

export const chaveCache = (usuarioId: string) => `rq-cache:${usuarioId}`

export function shouldDehydrateQuery(query: Query): boolean {
  return defaultShouldDehydrateQuery(query) && query.meta?.persistir === true
}

type QueryDesidratada = DehydratedState['queries'][number]

const ehMe = (chave: readonly unknown[]) => JSON.stringify(chave) === JSON.stringify(chaves.me())

/** Agenda, Placar e notícias guardam só as 2 primeiras páginas; os times próprios precisam de todas. */
const ehListaPaginavel = ([recurso, tipo]: readonly unknown[]) =>
  (recurso === 'eventos' || recurso === 'noticias') && tipo === 'lista'

function ehInfinita(dados: unknown): dados is { pages: unknown[]; pageParams: unknown[] } {
  return (
    typeof dados === 'object' &&
    dados !== null &&
    Array.isArray((dados as { pages?: unknown }).pages) &&
    Array.isArray((dados as { pageParams?: unknown }).pageParams)
  )
}

function reduzirDados(query: QueryDesidratada): unknown {
  const { data } = query.state
  if (ehMe(query.queryKey) && typeof data === 'object' && data !== null) {
    const { email: _email, ...semEmail } = data as Record<string, unknown>
    return semEmail
  }
  if (ehListaPaginavel(query.queryKey) && ehInfinita(data)) {
    return {
      pages: data.pages.slice(0, PAGINAS_PERSISTIDAS),
      pageParams: data.pageParams.slice(0, PAGINAS_PERSISTIDAS),
    }
  }
  return data
}

/** E-mail fora do disco (§10 da #29); a sessão local já o guarda e devolve na restauração. */
function devolverEmail(query: QueryDesidratada): QueryDesidratada {
  const email = useSessao.getState().usuario?.email
  const { data } = query.state
  if (!ehMe(query.queryKey) || !email || typeof data !== 'object' || data === null) return query
  return { ...query, state: { ...query.state, data: { ...data, email } } }
}

function mapearQueries(
  cliente: PersistedClient,
  transformar: (query: QueryDesidratada) => QueryDesidratada,
): PersistedClient {
  const { clientState } = cliente
  return {
    ...cliente,
    clientState: { ...clientState, queries: clientState.queries.map(transformar) },
  }
}

export function serializar(cliente: PersistedClient): string {
  return JSON.stringify(
    mapearQueries(cliente, (query) => ({
      ...query,
      state: { ...query.state, data: reduzirDados(query) },
    })),
  )
}

export function desserializar(texto: string): PersistedClient {
  return mapearQueries(JSON.parse(texto) as PersistedClient, devolverEmail)
}

const usuarioAtual = () => useSessao.getState().usuario?.id

/** Uma gravação atrasada pelo throttle não cai no cache depois que a sessão mudou. */
function armazenamentoDe(usuarioId: string) {
  return {
    getItem: (chave: string) => AsyncStorage.getItem(chave),
    removeItem: (chave: string) => AsyncStorage.removeItem(chave),
    setItem: async (chave: string, valor: string) => {
      if (usuarioAtual() !== usuarioId) return
      try {
        await AsyncStorage.setItem(chave, valor)
      } catch (erro) {
        Sentry.captureException(erro)
      }
    },
  }
}

export function criarPersister(usuarioId: string): Persister {
  return createAsyncStoragePersister({
    storage: armazenamentoDe(usuarioId),
    key: chaveCache(usuarioId),
    throttleTime: 1000,
    serialize: serializar,
    deserialize: desserializar,
  })
}

let persisterAtual: { usuarioId: string; persister: Persister } | undefined

function persisterDaSessao(): Persister | undefined {
  const usuarioId = usuarioAtual()
  if (!usuarioId) return undefined
  if (persisterAtual?.usuarioId !== usuarioId) {
    persisterAtual = { usuarioId, persister: criarPersister(usuarioId) }
  }
  return persisterAtual.persister
}

/** Sem sessão não grava nem restaura nada; com sessão, usa a chave do usuário atual. */
export const persister: Persister = {
  persistClient: async (cliente) => persisterDaSessao()?.persistClient(cliente),
  restoreClient: async () => persisterDaSessao()?.restoreClient(),
  removeClient: async () => persisterDaSessao()?.removeClient(),
}

export const opcoesPersistencia = {
  persister,
  maxAge: MAX_AGE,
  buster: BUSTER,
  dehydrateOptions: { shouldDehydrateQuery },
}

export async function limparCachePersistido(usuarioId: string): Promise<void> {
  await AsyncStorage.removeItem(chaveCache(usuarioId)).catch(() => undefined)
}

/** Logout, exclusão de conta e `401` do refresh passam pela transição para `'anonimo'`. */
export function limparCacheAoSairDaSessao(): () => void {
  return useSessao.subscribe((estado, anterior) => {
    const usuarioId = anterior.usuario?.id
    if (estado.status !== 'anonimo' || anterior.status === 'anonimo' || !usuarioId) return
    void limparCachePersistido(usuarioId)
  })
}
