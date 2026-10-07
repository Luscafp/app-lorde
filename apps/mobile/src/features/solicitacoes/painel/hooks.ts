import {
  StatusSolicitacao,
  type FiltrosSolicitacoes,
  type ListaSolicitacoes,
  type SolicitacaoPainelDto,
} from '@atletica/shared'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query'
import { toast } from '@/components/ui'
import type { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { proximaPagina } from '@/infra/query/proxima-pagina'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { aprovarSolicitacao, listarSolicitacoes, rejeitarSolicitacao } from '../api'

const PREFIXO = chaves.solicitacoes({}).slice(0, 1)
const TOTAL_PENDENTES_STALE_MS = 30_000

/** A API manda a mensagem do atleta; o Painel fala com a diretoria (épico #18 §6). */
export const MENSAGENS_JA_ENCERRADA: Record<string, string> = {
  SOLICITACAO_CANCELADA: 'O atleta cancelou esta solicitação',
  SOLICITACAO_JA_AVALIADA: 'Esta solicitação já foi avaliada por outro membro da diretoria',
}

type Lista = InfiniteData<ListaSolicitacoes>
type Anteriores = { anteriores: [QueryKey, Lista | undefined][] }

export function useSolicitacoes(filtros: FiltrosSolicitacoes) {
  return useInfiniteQuery({
    queryKey: chaves.solicitacoes(filtros),
    queryFn: ({ pageParam, signal }) => listarSolicitacoes(filtros, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: proximaPagina,
  })
}

/** Indicador do Painel e aba "Pendentes (N)": só lê o `total`. */
export function useTotalPendentes(timeId?: string) {
  const filtros = { status: [StatusSolicitacao.PENDENTE], timeId }
  return useQuery({
    queryKey: chaves.solicitacoes({ ...filtros, limit: 1 }),
    queryFn: ({ signal }) => listarSolicitacoes(filtros, 1, signal, 1),
    select: ({ total }) => total,
    staleTime: TOTAL_PENDENTES_STALE_MS,
  })
}

function semItem(dados: Lista | undefined, id: string): Lista | undefined {
  if (!dados?.pages || !dados.pages.some(({ items }) => items.some((item) => item.id === id))) {
    return dados
  }
  const pages = dados.pages.map((pagina) => ({
    ...pagina,
    items: pagina.items.filter((item) => item.id !== id),
    total: pagina.total - 1,
  }))
  return { ...dados, pages }
}

/** Remoção otimista; já encerrada (409) não volta para a lista. */
function useAvaliacao(
  mutationFn: (id: string) => Promise<SolicitacaoPainelDto>,
  mensagemDeSucesso: string,
  prefixosDoSucesso: readonly QueryKey[] = [],
) {
  const cliente = useQueryClient()
  return useAcaoOnline<SolicitacaoPainelDto, ApiErro, string, Anteriores>({
    mutationFn,
    meta: { errosNaTela: Object.keys(MENSAGENS_JA_ENCERRADA) },
    onMutate: async (id) => {
      await cliente.cancelQueries({ queryKey: PREFIXO })
      const anteriores = cliente.getQueriesData<Lista>({ queryKey: PREFIXO })
      anteriores.forEach(([chave, dados]) => cliente.setQueryData(chave, semItem(dados, id)))
      return { anteriores }
    },
    onError: (erro, _id, contexto) => {
      const mensagem = MENSAGENS_JA_ENCERRADA[erro.code]
      if (mensagem) return toast.erro(mensagem)
      contexto?.anteriores.forEach(([chave, dados]) => cliente.setQueryData(chave, dados))
    },
    onSuccess: () => {
      toast.sucesso(mensagemDeSucesso)
      return Promise.all(
        prefixosDoSucesso.map((queryKey) => cliente.invalidateQueries({ queryKey })),
      )
    },
    onSettled: () => cliente.invalidateQueries({ queryKey: PREFIXO }),
  })
}

/** O atleta entra no elenco: times e elencos são recarregados. */
export function useAprovarSolicitacao() {
  return useAvaliacao((id) => aprovarSolicitacao(id), 'Solicitação aceita', [chaves.times.todos()])
}

export function useRejeitarSolicitacao() {
  return useAvaliacao((id) => rejeitarSolicitacao(id), 'Solicitação rejeitada')
}
