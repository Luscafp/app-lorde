import {
  listaPresencaDtoSchema,
  participacaoRespondidaDtoSchema,
  type ListaPresencaDto,
  type ParticipacaoRespondidaDto,
  type RegistrarPresencas,
  type ResponderParticipacao,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export async function responderParticipacao(
  eventoId: string,
  dados: ResponderParticipacao,
): Promise<ParticipacaoRespondidaDto> {
  const resposta = await api.put(`/eventos/${eventoId}/participacao`, dados)
  return participacaoRespondidaDtoSchema.parse(resposta)
}

export async function listarPresencas(
  eventoId: string,
  sinal?: AbortSignal,
): Promise<ListaPresencaDto> {
  return listaPresencaDtoSchema.parse(await api.get(`/eventos/${eventoId}/presencas`, { sinal }))
}

export async function registrarPresencas(
  eventoId: string,
  dados: RegistrarPresencas,
): Promise<ListaPresencaDto> {
  return listaPresencaDtoSchema.parse(await api.put(`/eventos/${eventoId}/presencas`, dados))
}
