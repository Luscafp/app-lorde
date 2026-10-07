import type { ListaNoticias } from '@atletica/shared'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { ehNaoEncontrado } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { proximaPagina } from '@/infra/query/proxima-pagina'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { buscarNoticia, LIMITE_PAGINA, listarNoticias } from './api'

type ListaEmCache = ListaNoticias | InfiniteData<ListaNoticias>

/** O `total` fica como veio do servidor: a paginação não pode parar antes da hora. */
function semNoticia(pagina: ListaNoticias, id: string): ListaNoticias {
  const items = pagina.items.filter((item) => item.id !== id)
  if (items.length === pagina.items.length) return pagina
  return { ...pagina, items }
}

/** Tira a notícia de toda lista em cache: a lista completa (paginada) e a da Home (#79). */
export function removerDasListas(cliente: QueryClient, id: string) {
  cliente.setQueriesData<ListaEmCache>({ queryKey: chaves.noticias.todos() }, (dados) => {
    if (!dados) return dados
    if ('pages' in dados) {
      return { ...dados, pages: dados.pages.map((pagina) => semNoticia(pagina, id)) }
    }
    if ('items' in dados) return semNoticia(dados, id)
    return dados
  })
}

function esquecerDetalhe(cliente: QueryClient, id: string) {
  cliente
    .getQueryCache()
    .find({ queryKey: chaves.noticias.detalhe(id), exact: true })
    ?.setState({ data: undefined, dataUpdatedAt: 0 })
}

export function useNoticias() {
  return useInfiniteQuery({
    queryKey: chaves.noticias.lista({ limit: LIMITE_PAGINA }),
    queryFn: ({ pageParam, signal }) =>
      listarNoticias({ page: pageParam, limit: LIMITE_PAGINA }, signal),
    initialPageParam: 1,
    getNextPageParam: proximaPagina,
    select: ({ pages }) => juntarPaginas(pages),
  })
}

export const LIMITE_ULTIMAS_HOME = 3

export function useUltimasNoticias() {
  return useQuery({
    queryKey: chaves.noticias.lista({ limit: LIMITE_ULTIMAS_HOME }),
    queryFn: ({ signal }) => listarNoticias({ page: 1, limit: LIMITE_ULTIMAS_HOME }, signal),
    select: ({ items }) => items,
  })
}

/** Despublicada ou excluída responde 404: some das listas e do detalhe em cache (épico #25 §4). */
export function useNoticia(id: string) {
  const cliente = useQueryClient()
  return useQuery({
    queryKey: chaves.noticias.detalhe(id),
    queryFn: async ({ signal }) => {
      try {
        return await buscarNoticia(id, signal)
      } catch (erro) {
        if (ehNaoEncontrado(erro)) {
          removerDasListas(cliente, id)
          esquecerDetalhe(cliente, id)
        }
        throw erro
      }
    },
  })
}
