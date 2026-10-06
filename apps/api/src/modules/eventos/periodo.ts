import { inicioDoDiaLocal, type PeriodoEventos } from '@atletica/shared'
import type { Prisma } from '../../generated/prisma/client'

/** RN18: cancelados e agendados ficam em "próximos" até o fim do dia local de `inicio`. */
function proximos(agora: Date): Prisma.EventoWhereInput {
  return {
    OR: [
      { status: 'EM_ANDAMENTO' },
      { status: { in: ['AGENDADO', 'CANCELADO'] }, inicio: { gte: inicioDoDiaLocal(agora) } },
    ],
  }
}

/** Predicado de `periodo` (épico #22 §3); `hojeLocal` sempre do relógio do servidor. */
export function filtroPeriodo(periodo: PeriodoEventos, agora: Date): Prisma.EventoWhereInput {
  if (periodo === 'PROXIMOS') return proximos(agora)
  if (periodo === 'PASSADOS') return { NOT: proximos(agora) }
  return {}
}

export function ordemPadrao(periodo: PeriodoEventos): Prisma.SortOrder {
  return periodo === 'PROXIMOS' ? 'asc' : 'desc'
}
