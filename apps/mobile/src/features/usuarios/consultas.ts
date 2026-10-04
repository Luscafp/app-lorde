import type { FiltrosUsuarios, SituacaoAlterada, UsuarioResumo } from '@atletica/shared'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from '@/components/ui/toast'
import type { ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { alterarSituacao, buscarUsuario, LIMITE_PAGINA, listarUsuarios } from './api'

export const ATRASO_BUSCA_MS = 300

/** Valor que só muda depois de `atrasoMs` sem novas alterações. */
export function useValorAtrasado<T>(valor: T, atrasoMs = ATRASO_BUSCA_MS): T {
  const [atrasado, setAtrasado] = useState(valor)
  useEffect(() => {
    const temporizador = setTimeout(() => setAtrasado(valor), atrasoMs)
    return () => clearTimeout(temporizador)
  }, [valor, atrasoMs])
  return atrasado
}

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
      toast.sucesso(situacao === 'ATIVO' ? 'Conta reativada' : 'Conta desativada'),
    // O toast de erro é global; recarregar mostra o motivo atualizado (ex.: NIVEL_INSUFICIENTE).
    onSettled: () => cliente.invalidateQueries({ queryKey: chaves.usuarios.todos() }),
  })
}
