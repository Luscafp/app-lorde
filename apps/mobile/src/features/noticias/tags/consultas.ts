import type { FiltrosTags } from '@atletica/shared'
import { useQuery } from '@tanstack/react-query'
import { chaves } from '@/infra/query/chaves'
import { persistida } from '@/infra/query/persistencia'
import { listarTags } from './api'

export function useTags(filtros: FiltrosTags, { enabled = true } = {}) {
  return useQuery({
    queryKey: chaves.tags(filtros),
    queryFn: ({ signal }) => listarTags(filtros, signal),
    select: ({ items }) => items,
    enabled,
    ...persistida,
  })
}
