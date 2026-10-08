import type { Modalidade, ModalidadeAtualizacao, ModalidadeCriacao } from '@atletica/shared'
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { persistida } from '@/infra/query/persistencia'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import {
  atualizarModalidade,
  buscarModalidades,
  criarModalidade,
  excluirModalidade,
  type FiltroModalidades,
} from './api'

const PREFIXO = chaves.modalidades().slice(0, 1)
const ERROS_DO_FORMULARIO = ['VALIDATION_ERROR', 'MODALIDADE_DUPLICADA']

export function useModalidades(filtro: FiltroModalidades = {}) {
  return useQuery({
    queryKey: chaves.modalidades(filtro),
    queryFn: ({ signal }) => buscarModalidades(filtro, signal),
    ...persistida,
  })
}

function useInvalidarModalidades() {
  const cliente = useQueryClient()
  return () => cliente.invalidateQueries({ queryKey: PREFIXO })
}

/** Os erros de campo ficam com o formulário. */
export function useCriarModalidade() {
  const invalidar = useInvalidarModalidades()
  return useAcaoOnline<Modalidade, ApiErro, ModalidadeCriacao>({
    mutationFn: (dados) => criarModalidade(dados),
    meta: { errosNaTela: ERROS_DO_FORMULARIO },
    onSuccess: invalidar,
  })
}

type Atualizacao = { id: string; dados: ModalidadeAtualizacao }
type Anteriores = { anteriores: [QueryKey, Modalidade[] | undefined][] }

/** Otimista, com rollback em erro; os erros de campo ficam com o formulário. */
export function useAtualizarModalidade() {
  const cliente = useQueryClient()
  return useAcaoOnline<Modalidade, ApiErro, Atualizacao, Anteriores>({
    mutationFn: ({ id, dados }) => atualizarModalidade(id, dados),
    meta: { errosNaTela: ERROS_DO_FORMULARIO },
    onMutate: async ({ id, dados }) => {
      await cliente.cancelQueries({ queryKey: PREFIXO })
      const anteriores = cliente.getQueriesData<Modalidade[]>({ queryKey: PREFIXO })
      cliente.setQueriesData<Modalidade[]>({ queryKey: PREFIXO }, (lista) =>
        lista?.map((modalidade) =>
          modalidade.id === id ? { ...modalidade, ...dados } : modalidade,
        ),
      )
      return { anteriores }
    },
    onError: (_erro, _variaveis, contexto) => {
      contexto?.anteriores.forEach(([chave, dados]) => cliente.setQueryData(chave, dados))
    },
    onSettled: () => cliente.invalidateQueries({ queryKey: PREFIXO }),
  })
}

/** O erro fica com a tela, que oferece desativar em `MODALIDADE_COM_DEPENDENCIAS`. */
export function useExcluirModalidade() {
  const invalidar = useInvalidarModalidades()
  return useAcaoOnline<void, ApiErro, string>({
    mutationFn: (id) => excluirModalidade(id),
    meta: { errosNaTela: ['MODALIDADE_COM_DEPENDENCIAS'] },
    onSuccess: invalidar,
  })
}
