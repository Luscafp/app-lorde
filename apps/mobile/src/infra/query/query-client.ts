import { MutationCache, QueryCache, QueryClient, type Mutation } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import {
  ApiErro,
  CodigoApi,
  ehErroTransitorio,
  ehSessaoEncerrada,
  MENSAGEM_ERRO_GENERICO,
} from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { aoEncerrarSessao } from '@/infra/sessao/store'

declare module '@tanstack/react-query' {
  interface Register {
    /** `errosNaTela`: códigos que a própria tela mostra, sem o toast global. */
    mutationMeta: { errosNaTela?: readonly string[] }
  }
}

const MINUTO = 60_000
const MAXIMO_TENTATIVAS = 2

export function deveRepetir(falhas: number, erro: unknown): boolean {
  return falhas < MAXIMO_TENTATIVAS && ehErroTransitorio(erro)
}

/** Sucesso é toast da própria tela; o encerramento de sessão já mostrou o seu toast. */
export function mostrarErroDaMutacao(
  erro: unknown,
  mutacao?: Pick<Mutation<unknown, unknown, unknown>, 'meta'>,
): void {
  if (ehSessaoEncerrada(erro)) return
  if (erro instanceof ApiErro && mutacao?.meta?.errosNaTela?.includes(erro.code)) return
  toast.erro(erro instanceof ApiErro ? erro.message : MENSAGEM_ERRO_GENERICO)
}

/** O cargo pode ter mudado (#28): reler o `['me']` atualiza o papel da sessão. */
function recarregarPapelSeNegado(cliente: QueryClient, erro: unknown): void {
  if (erro instanceof ApiErro && erro.code === CodigoApi.FORBIDDEN) {
    void cliente.invalidateQueries({ queryKey: chaves.me(), exact: true })
  }
}

export function criarQueryClient(): QueryClient {
  const cliente: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (erro) => recarregarPapelSeNegado(cliente, erro) }),
    mutationCache: new MutationCache({
      onError: (erro, _variaveis, _resultado, mutacao) => {
        recarregarPapelSeNegado(cliente, erro)
        mostrarErroDaMutacao(erro, mutacao)
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: MINUTO,
        gcTime: 24 * 60 * MINUTO,
        retry: deveRepetir,
        refetchOnReconnect: true,
      },
    },
  })
  return cliente
}

export const queryClient = criarQueryClient()

aoEncerrarSessao(() => queryClient.clear())
