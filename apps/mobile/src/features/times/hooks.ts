import type {
  AtleticaAdversaria,
  AtleticaAdversariaAtualizacao,
  AtleticaAdversariaCriacao,
  TimeAtualizacao,
  TimeCriacao,
  TimeDto,
} from '@atletica/shared'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { proximaPagina } from '@/infra/query/proxima-pagina'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { useValorAtrasado } from '@/infra/use-valor-atrasado'
import {
  atualizarAtleticaAdversaria,
  atualizarTime,
  buscarTime,
  criarAtleticaAdversaria,
  criarTime,
  excluirTime,
  listarAtleticasAdversarias,
  listarTimes,
  type FiltrosTimes,
} from './api'

export const TIME_COM_DEPENDENCIAS = 'TIME_COM_DEPENDENCIAS'
const ERROS_DO_TIME = [
  'VALIDATION_ERROR',
  'TIME_DUPLICADO',
  'TIME_COM_EVENTOS',
  'MODALIDADE_INATIVA',
]
const ERROS_DA_ATLETICA = ['VALIDATION_ERROR', 'ATLETICA_DUPLICADA']
const ATRASO_BUSCA_MS = 300

export function useTimes(filtros: FiltrosTimes) {
  return useInfiniteQuery({
    queryKey: chaves.times.lista(filtros),
    queryFn: ({ pageParam, signal }) => listarTimes(filtros, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: proximaPagina,
  })
}

export function useTime(id: string) {
  return useQuery({
    queryKey: chaves.times.detalhe(id),
    queryFn: ({ signal }) => buscarTime(id, signal),
  })
}

export function useAtleticasAdversarias(q?: string) {
  return useInfiniteQuery({
    queryKey: chaves.painel.adversarias.lista({ q }),
    queryFn: ({ pageParam, signal }) => listarAtleticasAdversarias(q, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: proximaPagina,
  })
}

/** Busca de adversárias pelo termo digitado, com atraso. */
export function useBuscaAdversarias() {
  const [termo, setTermo] = useState('')
  const busca = useValorAtrasado(termo.trim(), ATRASO_BUSCA_MS) || undefined
  const consulta = useAtleticasAdversarias(busca)
  return { termo, setTermo, busca, consulta }
}

/** Times mostram a sigla da adversária e adversárias contam times: uma escrita invalida os dois. */
function useInvalidar() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: chaves.times.todos() }),
      cliente.invalidateQueries({ queryKey: chaves.painel.adversarias.todos() }),
    ])
}

/** Os erros de campo ficam com o formulário. */
export function useCriarTime() {
  const invalidar = useInvalidar()
  return useAcaoOnline<TimeDto, ApiErro, TimeCriacao>({
    mutationFn: (dados) => criarTime(dados),
    meta: { errosNaTela: ERROS_DO_TIME },
    onSuccess: invalidar,
  })
}

type Atualizacao<T> = { id: string; dados: T }

/** Os erros de campo ficam com o formulário. */
export function useAtualizarTime() {
  const invalidar = useInvalidar()
  return useAcaoOnline<TimeDto, ApiErro, Atualizacao<TimeAtualizacao>>({
    mutationFn: ({ id, dados }) => atualizarTime(id, dados),
    meta: { errosNaTela: ERROS_DO_TIME },
    onSuccess: invalidar,
  })
}

/** O erro fica com a tela, que oferece desativar em `TIME_COM_DEPENDENCIAS`. */
export function useExcluirTime() {
  const invalidar = useInvalidar()
  return useAcaoOnline<void, ApiErro, string>({
    mutationFn: (id) => excluirTime(id),
    meta: { errosNaTela: [TIME_COM_DEPENDENCIAS] },
    onSuccess: invalidar,
  })
}

export function useCriarAtleticaAdversaria() {
  const invalidar = useInvalidar()
  return useAcaoOnline<AtleticaAdversaria, ApiErro, AtleticaAdversariaCriacao>({
    mutationFn: (dados) => criarAtleticaAdversaria(dados),
    meta: { errosNaTela: ERROS_DA_ATLETICA },
    onSuccess: invalidar,
  })
}

export function useAtualizarAtleticaAdversaria() {
  const invalidar = useInvalidar()
  return useAcaoOnline<AtleticaAdversaria, ApiErro, Atualizacao<AtleticaAdversariaAtualizacao>>({
    mutationFn: ({ id, dados }) => atualizarAtleticaAdversaria(id, dados),
    meta: { errosNaTela: ERROS_DA_ATLETICA },
    onSuccess: invalidar,
  })
}
