import type { SolicitacaoDto } from '@atletica/shared'
import { useQueryClient } from '@tanstack/react-query'
import type { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { cancelarSolicitacao, solicitarEntrada } from './api'

export const TIME_INATIVO = 'TIME_INATIVO'
const ERROS_DE_SITUACAO_DESATUALIZADA = [
  'SOLICITACAO_PENDENTE',
  'JA_E_MEMBRO',
  'SOLICITACAO_JA_AVALIADA',
]

/** O toast global mostra a mensagem da API; a situação desatualizada é recarregada. */
function useAcaoDeSolicitacao<TVariables>(
  timeId: string,
  mutationFn: (variaveis: TVariables) => Promise<SolicitacaoDto>,
) {
  const cliente = useQueryClient()
  const recarregar = () => cliente.invalidateQueries({ queryKey: chaves.times.detalhe(timeId) })
  return useAcaoOnline<SolicitacaoDto, ApiErro, TVariables>({
    mutationFn,
    onSuccess: recarregar,
    onError: (erro) => {
      if (ERROS_DE_SITUACAO_DESATUALIZADA.includes(erro.code)) void recarregar()
    },
  })
}

export function useSolicitarEntrada(timeId: string) {
  return useAcaoDeSolicitacao<void>(timeId, () => solicitarEntrada(timeId))
}

export function useCancelarSolicitacao(timeId: string) {
  return useAcaoDeSolicitacao(timeId, (id: string) => cancelarSolicitacao(id))
}
