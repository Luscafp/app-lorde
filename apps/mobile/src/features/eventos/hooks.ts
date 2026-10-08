import type {
  CriarEvento,
  CriarSerie,
  EditarEvento,
  EditarSeguintes,
  EscopoOcorrencia,
  EventoCanceladoDto,
  EventoDto,
  OcorrenciasAlteradasDto,
  PeriodoEventos,
  RegistrarResultado,
  SerieCriadaDto,
  StatusEvento,
  StatusEventoAlteradoDto,
} from '@atletica/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CodigoApi } from '@/infra/api/api-erro'
import type { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { persistida } from '@/infra/query/persistencia'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { toast } from '@/components/ui'
import {
  alterarStatusEvento,
  atualizarEvento,
  buscarEvento,
  cancelarEvento,
  contarAgendadosDaSerie,
  criarEvento,
  criarSerie,
  editarSeguintes,
  excluirEvento,
  filtrosAgendadosDaSerie,
  registrarResultado,
  type FiltrosEventos,
} from './api'
import { useEventos } from './consultas'

export const CodigoEvento = {
  TIME_INVALIDO: 'TIME_INVALIDO',
  TIME_INATIVO: 'TIME_INATIVO',
  MODALIDADE_INATIVA: 'MODALIDADE_INATIVA',
  ADVERSARIO_INVALIDO: 'ADVERSARIO_INVALIDO',
  MODALIDADES_DIFERENTES: 'MODALIDADES_DIFERENTES',
  EVENTO_COM_PARTICIPACOES: 'EVENTO_COM_PARTICIPACOES',
  EVENTO_COM_DEPENDENCIAS: 'EVENTO_COM_DEPENDENCIAS',
  SERIE_SEM_OCORRENCIAS: 'SERIE_SEM_OCORRENCIAS',
  CONFLITO_STATUS: 'CONFLITO_STATUS',
} as const

export const MENSAGEM_CONFLITO_STATUS = 'O status foi alterado por outra pessoa'

/** Erros que o formulário mostra no campo (todos trazem `details`). */
const ERROS_DO_FORMULARIO = [
  CodigoApi.VALIDATION_ERROR,
  CodigoEvento.TIME_INVALIDO,
  CodigoEvento.TIME_INATIVO,
  CodigoEvento.MODALIDADE_INATIVA,
  CodigoEvento.ADVERSARIO_INVALIDO,
  CodigoEvento.MODALIDADES_DIFERENTES,
  CodigoEvento.EVENTO_COM_PARTICIPACOES,
  CodigoEvento.SERIE_SEM_OCORRENCIAS,
]

export type FiltrosEventosPainel = Pick<FiltrosEventos, 'tipo' | 'status' | 'resultado'> & {
  periodo: PeriodoEventos
}

/** O Painel vê também os eventos de times inativos. */
export function useEventosPainel(filtros: FiltrosEventosPainel) {
  return useEventos({ ...filtros, incluirInativos: true })
}

/** Sem o placeholder do card: o formulário precisa do detalhe completo. */
export function useEventoPainel(id: string) {
  return useQuery({
    queryKey: chaves.eventos.detalhe(id),
    queryFn: ({ signal }) => buscarEvento(id, signal),
    ...persistida,
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

export function useCriarSerie() {
  const invalidar = useInvalidar()
  return useAcaoOnline<SerieCriadaDto, ApiErro, CriarSerie>({
    mutationFn: (dados) => criarSerie(dados),
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

export function useEditarSeguintes() {
  const invalidar = useInvalidar()
  return useAcaoOnline<OcorrenciasAlteradasDto, ApiErro, { id: string; dados: EditarSeguintes }>({
    mutationFn: ({ id, dados }) => editarSeguintes(id, dados),
    meta: { errosNaTela: ERROS_DO_FORMULARIO },
    onSuccess: invalidar,
  })
}

/** 409: outra pessoa mudou o evento; recarrega o detalhe e as listas. */
function useRecarregarSeConflito() {
  const invalidar = useInvalidar()
  return (erro: ApiErro) => {
    if (erro.status !== 409) return
    if (erro.code === CodigoEvento.CONFLITO_STATUS) toast.erro(MENSAGEM_CONFLITO_STATUS)
    return invalidar()
  }
}

export function useAlterarStatus() {
  const invalidar = useInvalidar()
  const recarregarSeConflito = useRecarregarSeConflito()
  return useAcaoOnline<StatusEventoAlteradoDto, ApiErro, { id: string; status: StatusEvento }>({
    mutationFn: ({ id, status }) => alterarStatusEvento(id, status),
    meta: { errosNaTela: [CodigoEvento.CONFLITO_STATUS] },
    onSuccess: invalidar,
    onError: recarregarSeConflito,
  })
}

export function useRegistrarResultado() {
  const invalidar = useInvalidar()
  const recarregarSeConflito = useRecarregarSeConflito()
  return useAcaoOnline<EventoDto, ApiErro, { id: string; dados: RegistrarResultado }>({
    mutationFn: ({ id, dados }) => registrarResultado(id, dados),
    meta: { errosNaTela: [CodigoEvento.CONFLITO_STATUS] },
    onSuccess: invalidar,
    onError: recarregarSeConflito,
  })
}

type Cancelamento = { id: string; escopo?: EscopoOcorrencia }

export function useCancelarEvento() {
  const invalidar = useInvalidar()
  return useAcaoOnline<EventoCanceladoDto, ApiErro, Cancelamento>({
    mutationFn: ({ id, escopo }) => cancelarEvento(id, escopo),
    onSuccess: invalidar,
  })
}

/** Treinos agendados da série a partir de `inicio` (inclusive); sem série, não consulta. */
export function useAgendadosDaSerie(serieId: string | null, inicio: string) {
  return useQuery({
    queryKey: chaves.eventos.lista(filtrosAgendadosDaSerie(serieId ?? '', inicio)),
    queryFn: ({ signal }) => contarAgendadosDaSerie(serieId ?? '', inicio, signal),
    enabled: serieId !== null,
  })
}

/** O detalhe sai do cache antes de invalidar: relê-lo daria 404 na tela que está saindo. */
export function useExcluirEvento() {
  const cliente = useQueryClient()
  const invalidar = useInvalidar()
  return useAcaoOnline<void, ApiErro, string>({
    mutationFn: (id) => excluirEvento(id),
    meta: { errosNaTela: [CodigoEvento.EVENTO_COM_DEPENDENCIAS] },
    onSuccess: (_resultado, id) => {
      cliente.removeQueries({ queryKey: chaves.eventos.detalhe(id), exact: true })
      return invalidar()
    },
  })
}
