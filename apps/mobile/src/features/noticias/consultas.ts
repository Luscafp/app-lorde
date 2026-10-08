import type { ListaNoticias } from '@atletica/shared'
import { useInfiniteQuery, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ehNaoEncontrado } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { persistida } from '@/infra/query/persistencia'
import { proximaPagina } from '@/infra/query/proxima-pagina'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { semItemNaLista, type ListaEmCache } from '@/infra/query/sem-item'
import { buscarNoticia, LIMITE_PAGINA, listarNoticias } from './api'

/** Tira a notícia de toda lista em cache: a lista completa (paginada) e a da Home (#79). */
export function removerDasListas(cliente: QueryClient, id: string) {
  cliente.setQueriesData<ListaEmCache<ListaNoticias>>(
    { queryKey: chaves.noticias.todos() },
    (dados) => {
      if (!dados || !('pages' in dados || 'items' in dados)) return dados
      return semItemNaLista(dados, id)
    },
  )
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
    ...persistida,
  })
}

const LIMITE_ULTIMAS = 3

export function useUltimasNoticias() {
  return useQuery({
    queryKey: chaves.noticias.lista({ limit: LIMITE_ULTIMAS }),
    queryFn: ({ signal }) => listarNoticias({ page: 1, limit: LIMITE_ULTIMAS }, signal),
    select: ({ items }) => items.slice(0, LIMITE_ULTIMAS),
    ...persistida,
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
    ...persistida,
  })
}
