import {
  PeriodoEventos,
  type ContagemParticipacao,
  type EventoDetalheDto,
  type ParticipacaoRespondidaDto,
} from '@atletica/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ehDetalhe,
  listarEventos,
  type EventoEmTela,
  type FiltrosEventos,
} from '@/features/eventos'
import type { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { responderParticipacao } from './api'

export const LIMITE_MEUS_PROXIMOS = 5

const FILTROS_MEUS_PROXIMOS: FiltrosEventos = {
  periodo: PeriodoEventos.PROXIMOS,
  confirmadoPorMim: true,
}

/** Recusas que indicam detalhe desatualizado (elenco ou status mudaram). */
const STATUS_DESATUALIZADO = [403, 422]

export function contagemComResposta(
  contagem: ContagemParticipacao,
  anterior: boolean | undefined,
  confirmado: boolean,
): ContagemParticipacao {
  if (anterior === confirmado) return contagem
  const delta = (valor: boolean) => Number(confirmado === valor) - Number(anterior === valor)
  return {
    ...contagem,
    confirmados: contagem.confirmados + delta(true),
    recusados: contagem.recusados + delta(false),
    semResposta: contagem.semResposta - Number(anterior === undefined),
  }
}

type Contexto = { anterior?: EventoEmTela }

/** Otimista no detalhe; o sucesso invalida `['eventos']` (chips da Agenda e Perfil). */
export function useResponderParticipacao(eventoId: string) {
  const cliente = useQueryClient()
  const chave = chaves.eventos.detalhe(eventoId)

  return useAcaoOnline<ParticipacaoRespondidaDto, ApiErro, boolean, Contexto>({
    mutationFn: (confirmado) => responderParticipacao(eventoId, { confirmado }),
    onMutate: async (confirmado) => {
      await cliente.cancelQueries({ queryKey: chave, exact: true })
      const anterior = cliente.getQueryData<EventoEmTela>(chave)
      if (anterior && ehDetalhe(anterior)) {
        cliente.setQueryData<EventoDetalheDto>(chave, {
          ...anterior,
          minhaParticipacao: { confirmado, respondidoEm: new Date().toISOString() },
          contagem: contagemComResposta(
            anterior.contagem,
            anterior.minhaParticipacao?.confirmado,
            confirmado,
          ),
        })
      }
      return { anterior }
    },
    onError: (erro, _confirmado, contexto) => {
      if (contexto?.anterior) cliente.setQueryData(chave, contexto.anterior)
      if (STATUS_DESATUALIZADO.includes(erro.status)) {
        void cliente.invalidateQueries({ queryKey: chave, exact: true })
      }
    },
    onSuccess: ({ confirmado, respondidoEm, contagem }) => {
      cliente.setQueryData<EventoEmTela>(chave, (atual) =>
        atual && ehDetalhe(atual)
          ? { ...atual, minhaParticipacao: { confirmado, respondidoEm }, contagem }
          : atual,
      )
      void cliente.invalidateQueries({ queryKey: chaves.eventos.todos() })
    },
  })
}

/** Convenções §11.10: sem chave própria, só os filtros mudam. */
export function useMeusProximosEventos() {
  return useQuery({
    queryKey: chaves.eventos.lista({ ...FILTROS_MEUS_PROXIMOS, limit: LIMITE_MEUS_PROXIMOS }),
    queryFn: ({ signal }) =>
      listarEventos(FILTROS_MEUS_PROXIMOS, { page: 1, limit: LIMITE_MEUS_PROXIMOS }, signal),
    select: ({ items }) => items,
  })
}
