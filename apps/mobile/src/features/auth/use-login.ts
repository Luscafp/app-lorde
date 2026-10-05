import type { LoginEntrada } from '@atletica/shared'
import { CodigoApi } from '@/infra/api/api-erro'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { useSessao } from '@/infra/sessao/store'
import { entrar } from './api'

const ERROS_NA_TELA = [
  CodigoApi.CREDENCIAIS_INVALIDAS,
  CodigoApi.CONTA_DESATIVADA,
  CodigoApi.RATE_LIMITED,
]

export function useLogin() {
  return useAcaoOnline({
    mutationFn: (dados: LoginEntrada) => entrar(dados),
    onSuccess: (resposta) => useSessao.getState().iniciarSessao(resposta),
    meta: { errosNaTela: ERROS_NA_TELA },
  })
}
