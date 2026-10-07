import {
  eventoCanceladoDtoSchema,
  eventoDetalheSchema,
  eventoDtoSchema,
  type CriarEvento,
  type EditarEvento,
  type EventoCanceladoDto,
  type EventoDetalheDto,
  type EventoDto,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

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
