import type { EventoDetalheDto, EventoResumoDto, ListaEventos } from '@atletica/shared'
import {
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { chaves } from '@/infra/query/chaves'
import { buscarEvento } from './api'

/** O resumo do card abre a tela na hora (RNF03); contagem e "Quem vai" chegam com o detalhe. */
export type EventoEmTela = EventoResumoDto | EventoDetalheDto

export const ehDetalhe = (evento: EventoEmTela): evento is EventoDetalheDto => 'contagem' in evento

function paginas(dados: unknown): ListaEventos[] {
  if (!dados || typeof dados !== 'object') return []
  if ('pages' in dados) return (dados as InfiniteData<ListaEventos>).pages
  if ('items' in dados) return [dados as ListaEventos]
  return []
}

/** Procura o evento nas listas em cache: Agenda (paginada), Home, Times e Perfil. */
function resumoEmCache(cliente: QueryClient, id: string): EventoResumoDto | undefined {
  for (const [, dados] of cliente.getQueriesData({ queryKey: chaves.eventos.todos() })) {
    for (const pagina of paginas(dados)) {
      const item = pagina.items.find((evento) => evento.id === id)
      if (item) return item
    }
  }
  return undefined
}

export function useEvento(id: string) {
  const cliente = useQueryClient()
  return useQuery<EventoEmTela>({
    queryKey: chaves.eventos.detalhe(id),
    queryFn: ({ signal }) => buscarEvento(id, signal),
    placeholderData: () => resumoEmCache(cliente, id),
  })
}
