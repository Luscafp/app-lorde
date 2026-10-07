import type { UseQueryResult } from '@tanstack/react-query'

type Parcial = Pick<UseQueryResult<unknown>, 'isError' | 'isRefetching' | 'dataUpdatedAt'> & {
  refetch: () => Promise<unknown>
}

/** Estado conjunto de consultas que uma tela mostra como uma só. */
export function combinarConsultas(consultas: Parcial[]) {
  return {
    isError: consultas.some((c) => c.isError),
    isRefetching: consultas.some((c) => c.isRefetching),
    dataUpdatedAt: Math.min(...consultas.map((c) => c.dataUpdatedAt)),
    refetch: () => Promise.all(consultas.map((c) => c.refetch())),
  }
}
