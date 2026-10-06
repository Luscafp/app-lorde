import type { EventoDto } from '@atletica/shared'
import type { Prisma } from '../../generated/prisma/client'

export const CAMPOS_EVENTO = {
  id: true,
  tipo: true,
  status: true,
  inicio: true,
  local: true,
  observacoes: true,
  serieId: true,
  timeId: true,
  timeAdversarioId: true,
  placarTime: true,
  placarAdversario: true,
  resultado: true,
  criadoEm: true,
  atualizadoEm: true,
  time: {
    select: { id: true, nome: true, modalidade: { select: { id: true, nome: true, icone: true } } },
  },
  timeAdversario: {
    select: { id: true, nome: true, atletica: { select: { id: true, nome: true, sigla: true } } },
  },
} as const satisfies Prisma.EventoSelect

export type LinhaEvento = Prisma.EventoGetPayload<{ select: typeof CAMPOS_EVENTO }>

export function paraEventoDto(evento: LinhaEvento): EventoDto {
  const { modalidade, ...time } = evento.time
  return {
    id: evento.id,
    tipo: evento.tipo,
    status: evento.status,
    inicio: evento.inicio.toISOString(),
    local: evento.local,
    observacoes: evento.observacoes,
    serieId: evento.serieId,
    time,
    modalidade,
    timeAdversario: evento.timeAdversario,
    placarTime: evento.placarTime,
    placarAdversario: evento.placarAdversario,
    resultado: evento.resultado,
    criadoEm: evento.criadoEm.toISOString(),
    atualizadoEm: evento.atualizadoEm.toISOString(),
  }
}
