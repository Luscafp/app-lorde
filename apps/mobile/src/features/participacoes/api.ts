import {
  participacaoRespondidaDtoSchema,
  type ParticipacaoRespondidaDto,
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
