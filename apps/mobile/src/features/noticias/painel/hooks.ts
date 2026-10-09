import type {
  FiltrosNoticiasPainel,
  NoticiaAtualizacao,
  NoticiaCriacao,
  NoticiaPainelDetalheDto,
} from '@atletica/shared'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { proximaPagina } from '@/infra/query/proxima-pagina'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import {
  atualizarNoticia,
  buscarNoticiaPainel,
  criarNoticia,
  despublicarNoticia,
  excluirNoticia,
  listarNoticiasPainel,
  publicarNoticia,
} from './api'
import { ERROS_DO_FORMULARIO } from './erros'

export function useNoticiasPainel(filtros: FiltrosNoticiasPainel) {
  return useInfiniteQuery({
    queryKey: chaves.painel.noticias.lista(filtros),
    queryFn: ({ pageParam, signal }) => listarNoticiasPainel(filtros, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: proximaPagina,
  })
}

export function useNoticiaPainel(id: string) {
  return useQuery({
    queryKey: chaves.painel.noticias.detalhe(id),
    queryFn: ({ signal }) => buscarNoticiaPainel(id, signal),
  })
}

/** O Painel e a leitura pública (#78) mostram a mesma notícia; `tags({})` casa com todos os filtros. */
function useInvalidar() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: chaves.painel.noticias.todos() }),
      cliente.invalidateQueries({ queryKey: chaves.noticias.todos() }),
      cliente.invalidateQueries({ queryKey: chaves.tags({}) }),
    ])
}

/** Os erros de campo ficam com o formulário. */
export function useCriarNoticia() {
  const invalidar = useInvalidar()
  return useAcaoOnline<NoticiaPainelDetalheDto, ApiErro, NoticiaCriacao>({
    mutationFn: (dados) => criarNoticia(dados),
    meta: { errosNaTela: ERROS_DO_FORMULARIO },
    onSuccess: invalidar,
  })
}

type Atualizacao = { id: string; dados: NoticiaAtualizacao }

export function useAtualizarNoticia() {
  const invalidar = useInvalidar()
  return useAcaoOnline<NoticiaPainelDetalheDto, ApiErro, Atualizacao>({
    mutationFn: ({ id, dados }) => atualizarNoticia(id, dados),
    meta: { errosNaTela: ERROS_DO_FORMULARIO },
    onSuccess: invalidar,
  })
}

export function usePublicarNoticia() {
  const invalidar = useInvalidar()
  return useAcaoOnline<NoticiaPainelDetalheDto, ApiErro, string>({
    mutationFn: (id) => publicarNoticia(id),
    meta: { errosNaTela: ERROS_DO_FORMULARIO },
    onSuccess: invalidar,
  })
}

export function useDespublicarNoticia() {
  const invalidar = useInvalidar()
  return useAcaoOnline<NoticiaPainelDetalheDto, ApiErro, string>({
    mutationFn: (id) => despublicarNoticia(id),
    onSuccess: invalidar,
  })
}

/** O detalhe sai do cache antes de invalidar: relê-lo daria 404 na tela que está saindo. */
export function useExcluirNoticia() {
  const cliente = useQueryClient()
  const invalidar = useInvalidar()
  return useAcaoOnline<void, ApiErro, string>({
    mutationFn: (id) => excluirNoticia(id),
    onSuccess: (_resultado, id) => {
      cliente.removeQueries({ queryKey: chaves.painel.noticias.detalhe(id), exact: true })
      return invalidar()
    },
  })
}
