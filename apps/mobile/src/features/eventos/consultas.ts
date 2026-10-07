import type { EventoDetalheDto, EventoResumoDto, ListaEventos } from '@atletica/shared'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { chaves } from '@/infra/query/chaves'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { proximaPagina } from '@/infra/query/proxima-pagina'
import { buscarEvento, LIMITE_PAGINA, listarEventos, type FiltrosEventos } from './api'

/** O resumo do card abre a tela na hora (RNF03); contagem e "Quem vai" chegam com o detalhe. */
export type EventoEmTela = EventoResumoDto | EventoDetalheDto

export const ehDetalhe = (evento: EventoEmTela): evento is EventoDetalheDto => 'contagem' in evento

type EventosEmCache = ListaEventos | InfiniteData<ListaEventos> | EventoDetalheDto

function paginas(dados: EventosEmCache | undefined): ListaEventos[] {
  if (!dados) return []
  if ('pages' in dados) return dados.pages
  if ('items' in dados) return [dados]
  return []
}

/** Procura o evento nas listas em cache: Agenda (paginada), Home, Times e Perfil. */
function cardEmCache(cliente: QueryClient, id: string) {
  const consultas = cliente.getQueriesData<EventosEmCache>({ queryKey: chaves.eventos.todos() })
  for (const [chave, dados] of consultas) {
    const evento = paginas(dados)
      .flatMap((pagina) => pagina.items)
      .find((item) => item.id === id)
    if (evento) return { evento, atualizadoEm: cliente.getQueryState(chave)?.dataUpdatedAt ?? 0 }
  }
  return undefined
}

export function useEvento(id: string) {
  const cliente = useQueryClient()
  const card = cardEmCache(cliente, id)
  const consulta = useQuery<EventoEmTela>({
    queryKey: chaves.eventos.detalhe(id),
    queryFn: ({ signal }) => buscarEvento(id, signal),
    placeholderData: card?.evento,
  })
  if (!consulta.isPlaceholderData) return consulta
  return { ...consulta, dataUpdatedAt: card?.atualizadoEm ?? 0 }
}

/** `limit` na chave separa a lista paginada das listas curtas (Home, #79) com os mesmos filtros. */
export function useEventos(filtros: FiltrosEventos) {
  return useInfiniteQuery({
    queryKey: chaves.eventos.lista({ ...filtros, limit: LIMITE_PAGINA }),
    queryFn: ({ pageParam, signal }) => listarEventos(filtros, { page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: proximaPagina,
    select: ({ pages }) => juntarPaginas(pages),
  })
}

/** Lista curta sem paginação: só a primeira página, com no máximo `limit` itens. */
export function useProximosEventos(filtros: FiltrosEventos, limit: number) {
  return useQuery({
    queryKey: chaves.eventos.lista({ ...filtros, limit }),
    queryFn: ({ signal }) => listarEventos(filtros, { page: 1, limit }, signal),
    select: (lista) => ({ ...lista, items: lista.items.slice(0, limit) }),
  })
}
