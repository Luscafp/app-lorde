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
