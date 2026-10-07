import { solicitacaoDtoSchema, type SolicitacaoDto } from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export async function solicitarEntrada(timeId: string): Promise<SolicitacaoDto> {
  return solicitacaoDtoSchema.parse(await api.post(`/times/${timeId}/solicitacoes`))
}

export async function cancelarSolicitacao(id: string): Promise<SolicitacaoDto> {
  return solicitacaoDtoSchema.parse(await api.post(`/solicitacoes/${id}/cancelar`))
}
