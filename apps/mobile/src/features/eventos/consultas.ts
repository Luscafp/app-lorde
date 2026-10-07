import { useInfiniteQuery } from '@tanstack/react-query'
import { chaves } from '@/infra/query/chaves'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { proximaPagina } from '@/infra/query/proxima-pagina'
import { LIMITE_PAGINA, listarEventos, type FiltrosEventos } from './api'

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
