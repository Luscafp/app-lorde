import { Injectable } from '@nestjs/common'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import {
  erroAdversarioInvalido,
  erroModalidadeInativa,
  erroModalidadesDiferentes,
  erroTimeInativo,
  erroTimeInvalido,
} from './erros'

export interface TimeDoEvento {
  id: string
  modalidadeId: string
}

const CAMPOS_TIME = {
  atleticaId: true,
  ativo: true,
  modalidadeId: true,
  modalidade: { select: { ativa: true } },
} as const

/** Regras que dependem do banco (épico #19 §14), sempre dentro da transação da escrita. */
@Injectable()
export class EventosValidator {
  /** Time da atlética ativa, ativo e de modalidade ativa (RN10). */
  async validarTime(
    tx: TransacaoComEscopo,
    timeId: string,
    atleticaId: string,
  ): Promise<TimeDoEvento> {
    const time = await tx.time.findUnique({ where: { id: timeId }, select: CAMPOS_TIME })
    if (!time || time.atleticaId !== atleticaId) throw erroTimeInvalido()
    if (!time.ativo) throw erroTimeInativo()
    if (!time.modalidade.ativa) throw erroModalidadeInativa()
    return { id: timeId, modalidadeId: time.modalidadeId }
  }

  /** Adversário de outra atlética, ativo, diferente do time e da mesma modalidade (RN11). */
  async validarAdversario(
    tx: TransacaoComEscopo,
    timeAdversarioId: string | null,
    time: TimeDoEvento,
    atleticaId: string,
  ): Promise<void> {
    if (timeAdversarioId === null) return
    if (timeAdversarioId === time.id) throw erroAdversarioInvalido()
    const adversario = await tx.time.findUnique({
      where: { id: timeAdversarioId },
      select: CAMPOS_TIME,
    })
    if (!adversario || adversario.atleticaId === atleticaId || !adversario.ativo) {
      throw erroAdversarioInvalido()
    }
    if (adversario.modalidadeId !== time.modalidadeId) throw erroModalidadesDiferentes()
  }
}
