import {
  ehDiretoria,
  SituacaoUsuario,
  type AlterarPapel,
  type FiltrosUsuarios,
  type PapelAlterado,
  type SituacaoAlterada,
  type UsuarioResumo,
} from '@atletica/shared'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { toast } from '@/components/ui/toast'
import type { ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { useSessao } from '@/infra/sessao/store'
import { alterarPapel, alterarSituacao, buscarUsuario, LIMITE_PAGINA, listarUsuarios } from './api'

export function useListaUsuarios(filtros: FiltrosUsuarios) {
  return useInfiniteQuery({
    queryKey: chaves.usuarios.lista(filtros),
    queryFn: ({ pageParam, signal }) => listarUsuarios(filtros, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: ({ page, total }) => (page * LIMITE_PAGINA < total ? page + 1 : undefined),
  })
}

/** Páginas por offset podem repetir itens quando a lista muda entre elas (convenções §4.4). */
export function juntarPaginas(paginas: { items: UsuarioResumo[] }[]): UsuarioResumo[] {
  const vistos = new Set<string>()
  return paginas
    .flatMap(({ items }) => items)
    .filter(({ id }) => {
      if (vistos.has(id)) return false
      vistos.add(id)
      return true
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

export const ERROS_DO_CARGO = [
  'SUBSTITUICAO_NECESSARIA',
  'ULTIMO_ADMINISTRADOR',
  'USUARIO_DESATIVADO',
  'USUARIO_EXCLUIDO',
  'CONFLITO_CONCORRENTE',
]

/** Os erros de regra ficam com o sheet; o novo papel do próprio usuário vale já na sessão. */
export function useAlterarPapel(id: string) {
  const cliente = useQueryClient()
  return useAcaoOnline<PapelAlterado, ApiErro, AlterarPapel>({
    mutationFn: (corpo) => alterarPapel(id, corpo),
    meta: { errosNaTela: ERROS_DO_CARGO },
    onSuccess: async ({ alterado, usuario }) => {
      if (!alterado) return
      toast.sucesso('Cargo alterado')
      const sessao = useSessao.getState()
      if (usuario.id !== sessao.usuario?.id) return
      await sessao.atualizarUsuario({ papel: usuario.papel })
      void cliente.invalidateQueries({ queryKey: chaves.me() })
      if (!ehDiretoria(usuario.papel)) router.replace('/(app)/(abas)/perfil')
    },
    onSettled: () => cliente.invalidateQueries({ queryKey: chaves.usuarios.todos() }),
  })
}
