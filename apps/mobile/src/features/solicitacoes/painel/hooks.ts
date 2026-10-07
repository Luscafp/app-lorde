import {
  StatusSolicitacao,
  type FiltrosSolicitacoes,
  type ListaSolicitacoes,
  type SolicitacaoPainelDto,
} from '@atletica/shared'
import { useInfiniteQuery, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from '@/components/ui'
import type { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { proximaPagina } from '@/infra/query/proxima-pagina'
import { semItemNaLista, type ListaEmCache } from '@/infra/query/sem-item'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { aprovarSolicitacao, listarSolicitacoes, rejeitarSolicitacao } from '../api'

const PREFIXO = chaves.solicitacoes({}).slice(0, 1)
const TOTAL_PENDENTES_STALE_MS = 30_000
const SO_PENDENTES = { status: [StatusSolicitacao.PENDENTE] }

export const CodigoSolicitacao = {
  SOLICITACAO_CANCELADA: 'SOLICITACAO_CANCELADA',
  SOLICITACAO_JA_AVALIADA: 'SOLICITACAO_JA_AVALIADA',
} as const

type CodigoJaEncerrada = (typeof CodigoSolicitacao)[keyof typeof CodigoSolicitacao]

/** A API manda a mensagem do atleta; o Painel fala com a diretoria (épico #18 §6). */
const MENSAGENS_JA_ENCERRADA: Record<CodigoJaEncerrada, string> = {
  SOLICITACAO_CANCELADA: 'O atleta cancelou esta solicitação',
  SOLICITACAO_JA_AVALIADA: 'Esta solicitação já foi avaliada por outro membro da diretoria',
}

const jaEncerrada = (code: string): code is CodigoJaEncerrada => code in MENSAGENS_JA_ENCERRADA

type Lista = ListaEmCache<ListaSolicitacoes>
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
export function useTotalPendentes() {
  return useQuery({
    queryKey: chaves.solicitacoes({ ...SO_PENDENTES, limit: 1 }),
    queryFn: ({ signal }) => listarSolicitacoes(SO_PENDENTES, 1, signal, 1),
    select: ({ total }) => total,
    staleTime: TOTAL_PENDENTES_STALE_MS,
  })
}

/** Remoção otimista com rollback em erro; a lista é recarregada em ambos os casos. */
function useAvaliacao(
  mutationFn: (id: string) => Promise<SolicitacaoPainelDto>,
  mensagemDeSucesso: string,
  invalidarAoConcluir?: QueryKey,
) {
  const cliente = useQueryClient()
  return useAcaoOnline<SolicitacaoPainelDto, ApiErro, string, Anteriores>({
    mutationFn,
    meta: { errosNaTela: Object.values(CodigoSolicitacao) },
    onMutate: async (id) => {
      await cliente.cancelQueries({ queryKey: PREFIXO })
      const anteriores = cliente.getQueriesData<Lista>({ queryKey: PREFIXO })
      anteriores.forEach(([chave, dados]) =>
        cliente.setQueryData(chave, dados && semItemNaLista(dados, id)),
      )
      return { anteriores }
    },
    onError: (erro, _id, contexto) => {
      contexto?.anteriores.forEach(([chave, dados]) => cliente.setQueryData(chave, dados))
      if (jaEncerrada(erro.code)) toast.erro(MENSAGENS_JA_ENCERRADA[erro.code])
    },
    onSuccess: async () => {
      toast.sucesso(mensagemDeSucesso)
      if (invalidarAoConcluir) await cliente.invalidateQueries({ queryKey: invalidarAoConcluir })
    },
    onSettled: () => cliente.invalidateQueries({ queryKey: PREFIXO }),
  })
}

/** O atleta entra no elenco: times e elencos são recarregados. */
export function useAprovarSolicitacao() {
  return useAvaliacao((id) => aprovarSolicitacao(id), 'Solicitação aceita', chaves.times.todos())
}

export function useRejeitarSolicitacao() {
  return useAvaliacao((id) => rejeitarSolicitacao(id), 'Solicitação rejeitada')
}
