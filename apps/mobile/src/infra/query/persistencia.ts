import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Perfil } from '@atletica/shared'
import * as Sentry from '@sentry/react-native'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import {
  defaultShouldDehydrateQuery,
  hashKey,
  partialMatchKey,
  type DehydratedState,
  type Query,
} from '@tanstack/react-query'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import * as Application from 'expo-application'
import { chaves } from '@/infra/query/chaves'
import { useSessao } from '@/infra/sessao/store'

/** Mude ao alterar o formato de algum dado persistido: o cache antigo é descartado. */
export const VERSAO_FORMATO_CACHE = 1
export const IDADE_MAXIMA_CACHE_MS = 7 * 24 * 60 * 60_000
export const PAGINAS_PERSISTIDAS = 2
export const VERSAO_CACHE = `${Application.nativeApplicationVersion ?? '0'}-${VERSAO_FORMATO_CACHE}`

export const metaPersistida = { persistir: true } as const

/** `gcTime` ≥ `maxAge`, senão a query some antes de ser salva. */
export const persistida = { meta: metaPersistida, gcTime: IDADE_MAXIMA_CACHE_MS } as const

export const chaveCache = (usuarioId: string) => `rq-cache:${usuarioId}`

export function deveDesidratar(query: Query): boolean {
  return defaultShouldDehydrateQuery(query) && query.meta?.persistir === true
}

type QueryDesidratada = DehydratedState['queries'][number]
type MePersistido = Pick<Perfil, 'nome' | 'fotoUrl' | 'papel' | 'times'>

const ehMe = (chave: readonly unknown[]) => hashKey(chave) === hashKey(chaves.me())

/** Os times próprios precisam de todas as páginas. */
const LISTAS_RECORTADAS = [chaves.eventos.todos(), chaves.noticias.todos()]
const recortaPaginas = (chave: readonly unknown[]) =>
  LISTAS_RECORTADAS.some((prefixo) => partialMatchKey(chave, prefixo))

function ehInfinita(dados: unknown): dados is { pages: unknown[]; pageParams: unknown[] } {
  return (
    typeof dados === 'object' &&
    dados !== null &&
    Array.isArray((dados as { pages?: unknown }).pages) &&
    Array.isArray((dados as { pageParams?: unknown }).pageParams)
  )
}

const reduzirMe = ({ nome, fotoUrl, papel, times }: Perfil): MePersistido => ({
  nome,
  fotoUrl,
  papel,
  times,
})

function reduzirDados({ queryKey, state: { data } }: QueryDesidratada): unknown {
  if (ehMe(queryKey) && data) return reduzirMe(data as Perfil)
  if (recortaPaginas(queryKey) && ehInfinita(data)) {
    return {
      pages: data.pages.slice(0, PAGINAS_PERSISTIDAS),
      pageParams: data.pageParams.slice(0, PAGINAS_PERSISTIDAS),
    }
  }
  return data
}

/** `id` e e-mail ficam fora do cache; a sessão local os devolve. */
function completarMe(query: QueryDesidratada): QueryDesidratada {
  const usuario = useSessao.getState().usuario
  const { data } = query.state
  if (!ehMe(query.queryKey) || !usuario || !data) return query
  const me = { ...(data as MePersistido), id: usuario.id, email: usuario.email }
  return { ...query, state: { ...query.state, data: me } }
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
  return mapearQueries(JSON.parse(texto) as PersistedClient, completarMe)
}

const usuarioAtual = () => useSessao.getState().usuario?.id

/** Gravação atrasada pelo throttle não cai no cache de outra sessão. */
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

/** Recriado quando o usuário da sessão muda; sem sessão, nada é gravado nem restaurado. */
function persisterDoUsuario(): Persister | undefined {
  const usuarioId = usuarioAtual()
  if (!usuarioId) return undefined
  if (persisterAtual?.usuarioId !== usuarioId) {
    persisterAtual = { usuarioId, persister: criarPersister(usuarioId) }
  }
  return persisterAtual.persister
}

export const persisterDaSessao: Persister = {
  persistClient: async (cliente) => persisterDoUsuario()?.persistClient(cliente),
  restoreClient: async () => persisterDoUsuario()?.restoreClient(),
  removeClient: async () => persisterDoUsuario()?.removeClient(),
}

export const opcoesPersistencia = {
  persister: persisterDaSessao,
  maxAge: IDADE_MAXIMA_CACHE_MS,
  buster: VERSAO_CACHE,
  dehydrateOptions: { shouldDehydrateQuery: deveDesidratar },
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
