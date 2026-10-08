import { chaveDiaLocal, TipoEvento, type EventoResumoDto } from '@atletica/shared'
import { z } from 'zod'
import type { FiltrosEventos } from './api'

export type AbaAgenda = 'eventos' | 'placar'
export type FiltrosSelecionados = Pick<FiltrosEventos, 'tipo' | 'modalidadeId'>
export type PropsSegmentoAgenda = {
  filtros: FiltrosSelecionados
  aoMudarFiltros: (filtros: FiltrosSelecionados) => void
  aoAbrirEvento: (evento: EventoResumoDto) => void
}
export type ParametrosAgenda = { aba?: string; tipo?: string; modalidadeId?: string }
export type Dia<T> = { dia: string; eventos: T[] }
export type LinhaDia<T> = { dia: string; evento?: undefined } | { dia?: undefined; evento: T }

const tipoSchema = z.enum(TipoEvento)
const idSchema = z.uuid()

/** Parâmetro inválido na URL (deep link antigo, digitado) vale como "sem filtro". */
export function lerParametros({ aba, tipo, modalidadeId }: ParametrosAgenda): {
  aba: AbaAgenda
  filtros: FiltrosSelecionados
} {
  return {
    aba: aba === 'placar' ? 'placar' : 'eventos',
    filtros: {
      tipo: tipoSchema.safeParse(tipo).data,
      modalidadeId: idSchema.safeParse(modalidadeId).data,
    },
  }
}

/** Agrupa pelo dia local (America/Fortaleza), na ordem recebida da API. */
export function agruparPorDia<T extends { inicio: string }>(eventos: T[]): Dia<T>[] {
  const dias = new Map<string, T[]>()
  for (const evento of eventos) {
    const dia = chaveDiaLocal(evento.inicio)
    dias.set(dia, [...(dias.get(dia) ?? []), evento])
  }
  return [...dias].map(([dia, doDia]) => ({ dia, eventos: doDia }))
}

/** Cabeçalho de cada dia seguido dos seus eventos, para uma `FlatList` única. */
export function linhasPorDia<T extends { inicio: string }>(eventos: T[]): LinhaDia<T>[] {
  return agruparPorDia(eventos).flatMap(({ dia, eventos: doDia }) => [
    { dia },
    ...doDia.map((evento) => ({ evento })),
  ])
}

export const MENSAGEM_SEM_EVENTOS_FILTRADOS = 'Nenhum evento para os filtros escolhidos'

type AcaoVazio = { titulo: string; onPress: () => void }

/** Com algum filtro escolhido, o vazio oferece "Limpar filtros" no lugar da ação da tela. */
export function vazioEventos(
  filtros: object,
  limpar: () => void,
  semFiltros: { mensagem: string; acao?: AcaoVazio },
): { mensagemVazio: string; acaoVazio?: AcaoVazio } {
  const filtrado = Object.values(filtros).some((valor) => valor !== undefined)
  return filtrado
    ? {
        mensagemVazio: MENSAGEM_SEM_EVENTOS_FILTRADOS,
        acaoVazio: { titulo: 'Limpar filtros', onPress: limpar },
      }
    : { mensagemVazio: semFiltros.mensagem, acaoVazio: semFiltros.acao }
}
