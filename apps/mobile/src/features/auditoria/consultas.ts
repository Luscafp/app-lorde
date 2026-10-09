import type { FiltrosAuditoria } from '@atletica/shared'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { chaves } from '@/infra/query/chaves'
import { proximaPagina } from '@/infra/query/proxima-pagina'
import { buscarRegistroAuditoria, listarAuditoria } from './api'

/** Dado sensível: `chaves.auditoria` não é persistida (convenções §10.4). */
export function useListaAuditoria(filtros: FiltrosAuditoria) {
  return useInfiniteQuery({
    queryKey: chaves.auditoria(filtros),
    queryFn: ({ pageParam, signal }) => listarAuditoria(filtros, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: proximaPagina,
  })
}

export function useRegistroAuditoria(id: string) {
  return useQuery({
    queryKey: chaves.auditoria.detalhe(id),
    queryFn: ({ signal }) => buscarRegistroAuditoria(id, signal),
  })
}
