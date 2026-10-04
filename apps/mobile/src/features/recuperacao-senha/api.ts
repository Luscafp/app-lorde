import type {
  EsqueciSenhaEntrada,
  RedefinirSenhaEntrada,
  RespostaEsqueciSenha,
  RespostaVerificarCodigo,
  VerificarCodigoEntrada,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'
import { useAcaoOnline } from '@/infra/query/use-acao-online'

export const CODIGO_INVALIDO = 'CODIGO_INVALIDO'

export function useEnviarCodigo() {
  return useAcaoOnline({
    mutationFn: (dados: EsqueciSenhaEntrada) =>
      api.post<RespostaEsqueciSenha>('/auth/senha/esqueci', dados),
  })
}

export function useVerificarCodigo() {
  return useAcaoOnline({
    mutationFn: (dados: VerificarCodigoEntrada) =>
      api.post<RespostaVerificarCodigo>('/auth/senha/verificar-codigo', dados),
  })
}

export function useRedefinirSenha() {
  return useAcaoOnline({
    mutationFn: (dados: RedefinirSenhaEntrada) => api.post<void>('/auth/senha/redefinir', dados),
  })
}
