import type { CriarEvento, EditarEvento, EventoCanceladoDto, EventoDto } from '@atletica/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { atualizarEvento, buscarEvento, cancelarEvento, criarEvento, excluirEvento } from './api'

export const EVENTO_COM_DEPENDENCIAS = 'EVENTO_COM_DEPENDENCIAS'

/** Erros que o formulário mostra no campo (todos trazem `details`). */
const ERROS_DO_FORMULARIO = [
  'VALIDATION_ERROR',
  'TIME_INVALIDO',
  'TIME_INATIVO',
  'MODALIDADE_INATIVA',
  'ADVERSARIO_INVALIDO',
  'MODALIDADES_DIFERENTES',
  'EVENTO_COM_PARTICIPACOES',
]

export function useEvento(id: string) {
  return useQuery({
    queryKey: chaves.eventos.detalhe(id),
    queryFn: ({ signal }) => buscarEvento(id, signal),
  })
}

/** O prefixo `['eventos']` cobre listas e detalhes. */
function useInvalidar() {
  const cliente = useQueryClient()
  return () => cliente.invalidateQueries({ queryKey: chaves.eventos.todos() })
}

export function useCriarEvento() {
  const invalidar = useInvalidar()
  return useAcaoOnline<EventoDto, ApiErro, CriarEvento>({
    mutationFn: (dados) => criarEvento(dados),
    meta: { errosNaTela: ERROS_DO_FORMULARIO },
    onSuccess: invalidar,
  })
}

type Atualizacao = { id: string; dados: EditarEvento }

export function useAtualizarEvento() {
  const invalidar = useInvalidar()
  return useAcaoOnline<EventoDto, ApiErro, Atualizacao>({
    mutationFn: ({ id, dados }) => atualizarEvento(id, dados),
    meta: { errosNaTela: ERROS_DO_FORMULARIO },
    onSuccess: invalidar,
  })
}

export function useCancelarEvento() {
  const invalidar = useInvalidar()
  return useAcaoOnline<EventoCanceladoDto, ApiErro, string>({
    mutationFn: (id) => cancelarEvento(id),
    onSuccess: invalidar,
  })
}

/** O detalhe sai do cache antes de invalidar: relê-lo daria 404 na tela que está saindo. */
export function useExcluirEvento() {
  const cliente = useQueryClient()
  const invalidar = useInvalidar()
  return useAcaoOnline<void, ApiErro, string>({
    mutationFn: (id) => excluirEvento(id),
    meta: { errosNaTela: [EVENTO_COM_DEPENDENCIAS] },
    onSuccess: (_resultado, id) => {
      cliente.removeQueries({ queryKey: chaves.eventos.detalhe(id), exact: true })
      return invalidar()
    },
  })
}
