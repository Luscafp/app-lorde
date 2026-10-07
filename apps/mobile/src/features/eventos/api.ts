import {
  eventoCanceladoDtoSchema,
  eventoDetalheSchema,
  eventoDtoSchema,
  listaEventosSchema,
  type CriarEvento,
  type EditarEvento,
  type EventoCanceladoDto,
  type EventoDetalheDto,
  type EventoDto,
  type ListaEventos,
  type ListarEventosQuery,
  type StatusEvento,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export const LIMITE_PAGINA = 20

export type FiltrosEventos = Partial<Omit<ListarEventosQuery, 'page' | 'limit' | 'status'>> & {
  status?: StatusEvento
}

export async function listarEventos(
  filtros: FiltrosEventos,
  page: number,
  sinal?: AbortSignal,
): Promise<ListaEventos> {
  const resposta = await api.get('/eventos', {
    consulta: { ...filtros, page, limit: LIMITE_PAGINA },
    sinal,
  })
  return listaEventosSchema.parse(resposta)
}

export async function buscarEvento(id: string, sinal?: AbortSignal): Promise<EventoDetalheDto> {
  return eventoDetalheSchema.parse(await api.get(`/eventos/${id}`, { sinal }))
}

export async function criarEvento(dados: CriarEvento): Promise<EventoDto> {
  return eventoDtoSchema.parse(await api.post('/eventos', dados))
}

export async function atualizarEvento(id: string, dados: EditarEvento): Promise<EventoDto> {
  return eventoDtoSchema.parse(await api.patch(`/eventos/${id}`, dados))
}

export async function cancelarEvento(id: string): Promise<EventoCanceladoDto> {
  return eventoCanceladoDtoSchema.parse(await api.post(`/eventos/${id}/cancelar`))
}

export async function excluirEvento(id: string): Promise<void> {
  await api.delete(`/eventos/${id}`)
}
