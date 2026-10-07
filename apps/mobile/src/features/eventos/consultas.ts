import type { EventoResumoDto, ListaEventos } from '@atletica/shared'
import { useInfiniteQuery, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { chaves } from '@/infra/query/chaves'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { proximaPagina } from '@/infra/query/proxima-pagina'
import { LIMITE_PAGINA, listarEventos, type FiltrosEventos } from './api'

const PREFIXO_LISTAS = chaves.eventos.lista({}).slice(0, 2)

/** `limit` na chave separa a lista paginada das listas curtas (Home, #79) com os mesmos filtros. */
export function useEventos(filtros: FiltrosEventos) {
  return useInfiniteQuery({
    queryKey: chaves.eventos.lista({ ...filtros, limit: LIMITE_PAGINA }),
    queryFn: ({ pageParam, signal }) => listarEventos(filtros, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: proximaPagina,
    select: ({ pages }) => juntarPaginas(pages),
  })
}

/** Card já carregado em alguma lista: `placeholderData` do detalhe (RNF03, #77). */
export function eventoEmCache(cliente: QueryClient, id: string): EventoResumoDto | undefined {
  const listas = cliente.getQueriesData<ListaEventos | InfiniteData<ListaEventos>>({
    queryKey: PREFIXO_LISTAS,
  })
  for (const [, dados] of listas) {
    const paginas = dados && ('pages' in dados ? dados.pages : [dados])
    const evento = paginas?.flatMap(({ items }) => items).find((item) => item.id === id)
    if (evento) return evento
  }
  return undefined
}
