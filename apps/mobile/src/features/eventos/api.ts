import { eventoDetalheSchema, type EventoDetalheDto } from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export async function buscarEvento(id: string, sinal?: AbortSignal): Promise<EventoDetalheDto> {
  return eventoDetalheSchema.parse(await api.get(`/eventos/${id}`, { sinal }))
}
