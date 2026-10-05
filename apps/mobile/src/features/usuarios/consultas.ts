import { SituacaoUsuario, type FiltrosUsuarios, type SituacaoAlterada } from '@atletica/shared'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import type { ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { alterarSituacao, buscarUsuario, LIMITE_PAGINA, listarUsuarios } from './api'

export function useListaUsuarios(filtros: FiltrosUsuarios) {
  return useInfiniteQuery({
    queryKey: chaves.usuarios.lista(filtros),
    queryFn: ({ pageParam, signal }) => listarUsuarios(filtros, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: ({ page, total }) => (page * LIMITE_PAGINA < total ? page + 1 : undefined),
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
