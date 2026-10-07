import type { TimeDto } from '@atletica/shared'
import type { Prisma } from '../../generated/prisma/client'
import { ELENCO_ATUAL } from './membro'

export const CAMPOS_TIME = {
  id: true,
  nome: true,
  ativo: true,
  atleticaId: true,
  modalidadeId: true,
  modalidade: { select: { id: true, nome: true, icone: true } },
  atletica: { select: { id: true, nome: true, sigla: true } },
  capitao: { select: { id: true, nome: true } },
  _count: { select: { membros: { where: ELENCO_ATUAL } } },
} as const satisfies Prisma.TimeSelect

export type LinhaTime = Prisma.TimeGetPayload<{ select: typeof CAMPOS_TIME }>

/** Visível para quem não é da Diretoria (épico #16 §7). */
export const VISIVEL_PARA_TODOS = { ativo: true, modalidade: { ativa: true } } as const

export function paraDto(time: LinhaTime, atleticaAtual: string): TimeDto {
  const propria = time.atleticaId === atleticaAtual
  return {
    id: time.id,
    nome: time.nome,
    ativo: time.ativo,
    modalidade: time.modalidade,
    atletica: { ...time.atletica, propria },
    capitao: propria ? time.capitao : null,
    totalMembros: propria ? time._count.membros : 0,
  }
}
