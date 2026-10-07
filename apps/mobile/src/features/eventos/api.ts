import {
  listaEventosSchema,
  type ListaEventos,
  type ListarEventosQuery,
  type StatusEvento,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export const LIMITE_PAGINA = 20

export type FiltrosEventos = Partial<Omit<ListarEventosQuery, 'page' | 'limit' | 'status'>> & {
  status?: StatusEvento[]
}

export async function listarEventos(
  { status, ...filtros }: FiltrosEventos,
  page: number,
  sinal?: AbortSignal,
): Promise<ListaEventos> {
  const resposta = await api.get('/eventos', {
    consulta: { ...filtros, status: status?.join(','), page, limit: LIMITE_PAGINA },
    sinal,
  })
  return listaEventosSchema.parse(resposta)
}
