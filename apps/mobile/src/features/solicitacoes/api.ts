import {
  LIMITE_PADRAO,
  listaSolicitacoesSchema,
  solicitacaoDtoSchema,
  solicitacaoPainelDtoSchema,
  type FiltrosSolicitacoes,
  type ListaSolicitacoes,
  type SolicitacaoDto,
  type SolicitacaoPainelDto,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export async function solicitarEntrada(timeId: string): Promise<SolicitacaoDto> {
  return solicitacaoDtoSchema.parse(await api.post(`/times/${timeId}/solicitacoes`))
}

export async function cancelarSolicitacao(id: string): Promise<SolicitacaoDto> {
  return solicitacaoDtoSchema.parse(await api.post(`/solicitacoes/${id}/cancelar`))
}

export async function listarSolicitacoes(
  filtros: FiltrosSolicitacoes,
  page: number,
  sinal?: AbortSignal,
  limit = LIMITE_PADRAO,
): Promise<ListaSolicitacoes> {
  const resposta = await api.get('/solicitacoes', {
    consulta: { ...filtros, page, limit },
    sinal,
  })
  return listaSolicitacoesSchema.parse(resposta)
}

export async function aprovarSolicitacao(id: string): Promise<SolicitacaoPainelDto> {
  return solicitacaoPainelDtoSchema.parse(await api.post(`/solicitacoes/${id}/aprovar`))
}

export async function rejeitarSolicitacao(id: string): Promise<SolicitacaoPainelDto> {
  return solicitacaoPainelDtoSchema.parse(await api.post(`/solicitacoes/${id}/rejeitar`))
}
