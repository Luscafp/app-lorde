import type { Modalidade, ModalidadeCriacao } from '@atletica/shared'
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import {
  atualizarModalidade,
  buscarModalidades,
  criarModalidade,
  excluirModalidade,
  type FiltroModalidades,
} from './api'

const TODAS = chaves.modalidades.todas()

export function useModalidades(filtro: FiltroModalidades = {}) {
  return useQuery({
    queryKey: chaves.modalidades(filtro),
    queryFn: ({ signal }) => buscarModalidades(filtro, signal),
  })
}

function useInvalidarModalidades() {
  const cliente = useQueryClient()
  return () => cliente.invalidateQueries({ queryKey: TODAS })
}

/** Cadastro (sem `id`) ou edição; os erros ficam com o formulário. */
export function useSalvarModalidade(id?: string) {
  const invalidar = useInvalidarModalidades()
  return useAcaoOnline<Modalidade, ApiErro, ModalidadeCriacao>({
    mutationFn: (dados) => (id ? atualizarModalidade(id, dados) : criarModalidade(dados)),
    meta: { toastDeErro: false },
    onSuccess: invalidar,
  })
}

type Alternancia = { id: string; ativa: boolean }
type Anteriores = { anteriores: [QueryKey, Modalidade[] | undefined][] }

/** Atualização otimista; em erro volta ao estado anterior (o toast é o global). */
export function useAlternarAtiva() {
  const cliente = useQueryClient()
  return useAcaoOnline<Modalidade, ApiErro, Alternancia, Anteriores>({
    mutationFn: ({ id, ativa }) => atualizarModalidade(id, { ativa }),
    onMutate: async ({ id, ativa }) => {
      await cliente.cancelQueries({ queryKey: TODAS })
      const anteriores = cliente.getQueriesData<Modalidade[]>({ queryKey: TODAS })
      cliente.setQueriesData<Modalidade[]>({ queryKey: TODAS }, (lista) =>
        lista?.map((modalidade) => (modalidade.id === id ? { ...modalidade, ativa } : modalidade)),
      )
      return { anteriores }
    },
    onError: (_erro, _variaveis, contexto) => {
      contexto?.anteriores.forEach(([chave, dados]) => cliente.setQueryData(chave, dados))
    },
    onSettled: () => cliente.invalidateQueries({ queryKey: TODAS }),
  })
}

/** O erro fica com a tela, que oferece desativar em `MODALIDADE_COM_DEPENDENCIAS`. */
export function useExcluirModalidade() {
  const invalidar = useInvalidarModalidades()
  return useAcaoOnline<void, ApiErro, string>({
    mutationFn: (id) => excluirModalidade(id),
    meta: { toastDeErro: false },
    onSuccess: invalidar,
  })
}
