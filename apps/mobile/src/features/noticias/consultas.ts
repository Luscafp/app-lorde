import type { ListaNoticias, NoticiaResumoDto } from '@atletica/shared'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { buscarNoticia, LIMITE_PAGINA, listarNoticias } from './api'

type ListaEmCache = ListaNoticias | InfiniteData<ListaNoticias>

/** Páginas por offset podem repetir itens quando a lista muda entre elas (convenções §4.4). */
export function juntarPaginas(paginas: { items: NoticiaResumoDto[] }[]): NoticiaResumoDto[] {
  const vistos = new Set<string>()
  return paginas
    .flatMap(({ items }) => items)
    .filter(({ id }) => {
      if (vistos.has(id)) return false
      vistos.add(id)
      return true
    })
}

export function ehNaoEncontrada(erro: unknown): boolean {
  return erro instanceof ApiErro && erro.status === 404
}

function semNoticia(pagina: ListaNoticias, id: string): ListaNoticias {
  const items = pagina.items.filter((item) => item.id !== id)
  if (items.length === pagina.items.length) return pagina
  return { ...pagina, items, total: Math.max(0, pagina.total - 1) }
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

export function useNoticias() {
  return useInfiniteQuery({
    queryKey: chaves.noticias.lista({ limit: LIMITE_PAGINA }),
    queryFn: ({ pageParam, signal }) => listarNoticias(pageParam, LIMITE_PAGINA, signal),
    initialPageParam: 1,
    getNextPageParam: ({ page, limit, total }) => (page * limit < total ? page + 1 : undefined),
    select: ({ pages }) => juntarPaginas(pages),
  })
}

/** Despublicada ou excluída responde 404: some das listas em cache (épico #25 §4). */
export function useNoticia(id: string) {
  const cliente = useQueryClient()
  return useQuery({
    queryKey: chaves.noticias.detalhe(id),
    queryFn: async ({ signal }) => {
      try {
        return await buscarNoticia(id, signal)
      } catch (erro) {
        if (ehNaoEncontrada(erro)) removerDasListas(cliente, id)
        throw erro
      }
    },
  })
}
