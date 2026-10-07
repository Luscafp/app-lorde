import {
  SituacaoUsuario,
  type AlterarPapel,
  type FiltrosUsuarios,
  type PapelAlterado,
  type SituacaoAlterada,
} from '@atletica/shared'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { CodigoApi, type ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { proximaPagina } from '@/infra/query/proxima-pagina'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { alterarPapel, alterarSituacao, buscarUsuario, listarUsuarios } from './api'

export function useListaUsuarios(filtros: FiltrosUsuarios) {
  return useInfiniteQuery({
    queryKey: chaves.usuarios.lista(filtros),
    queryFn: ({ pageParam, signal }) => listarUsuarios(filtros, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: proximaPagina,
  })
}

export function useUsuario(id: string) {
  return useQuery({
    queryKey: chaves.usuarios.detalhe(id),
    queryFn: ({ signal }) => buscarUsuario(id, signal),
  })
}

export function useAlterarSituacao(id: string) {
  const cliente = useQueryClient()
  return useAcaoOnline<SituacaoAlterada, ApiErro, boolean>({
    mutationFn: (ativo) => alterarSituacao(id, ativo),
    onSuccess: ({ situacao }) =>
      toast.sucesso(situacao === SituacaoUsuario.ATIVO ? 'Conta reativada' : 'Conta desativada'),
    // O toast de erro é global; recarregar mostra o motivo atualizado (ex.: NIVEL_INSUFICIENTE).
    onSettled: () => cliente.invalidateQueries({ queryKey: chaves.usuarios.todos() }),
  })
}

export const ERROS_DO_CARGO: readonly string[] = [
  CodigoApi.SUBSTITUICAO_NECESSARIA,
  CodigoApi.ULTIMO_ADMINISTRADOR,
  CodigoApi.USUARIO_DESATIVADO,
  CodigoApi.USUARIO_EXCLUIDO,
  CodigoApi.CONFLITO_CONCORRENTE,
]

/** Os erros de regra ficam com o sheet. */
export function useAlterarPapel(id: string) {
  const cliente = useQueryClient()
  return useAcaoOnline<PapelAlterado, ApiErro, AlterarPapel>({
    mutationFn: (corpo) => alterarPapel(id, corpo),
    meta: { errosNaTela: ERROS_DO_CARGO },
    onSuccess: ({ alterado }) => {
      if (alterado) toast.sucesso('Cargo alterado')
    },
    onSettled: () => cliente.invalidateQueries({ queryKey: chaves.usuarios.todos() }),
  })
}
