import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import {
  ApiErro,
  CodigoLocal,
  ehErroTransitorio,
  MENSAGEM_ERRO_GENERICO,
} from '@/infra/api/api-erro'
import { aoEncerrarSessao } from '@/infra/sessao/store'

const MINUTO = 60_000
const MAXIMO_TENTATIVAS = 2

export function deveRepetir(falhas: number, erro: unknown): boolean {
  return falhas < MAXIMO_TENTATIVAS && ehErroTransitorio(erro)
}

/** Sucesso é toast da própria tela; o encerramento de sessão já mostrou o seu toast. */
export function mostrarErroDaMutacao(erro: unknown): void {
  if (erro instanceof ApiErro && erro.code === CodigoLocal.SESSAO_ENCERRADA) return
  toast.erro(erro instanceof ApiErro ? erro.message : MENSAGEM_ERRO_GENERICO)
}

export function criarQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({ onError: mostrarErroDaMutacao }),
    defaultOptions: {
      queries: {
        staleTime: MINUTO,
        gcTime: 24 * 60 * MINUTO,
        retry: deveRepetir,
        refetchOnReconnect: true,
      },
    },
  })
}

export const queryClient = criarQueryClient()

aoEncerrarSessao(() => queryClient.clear())
