import { z } from 'zod'
import { StatusEvento } from '../enums/evento'

/** Máquina de estados do épico #21 §4; as guardas de presença e resultado ficam na API. */
export const TRANSICOES_STATUS: Record<StatusEvento, readonly StatusEvento[]> = {
  AGENDADO: ['EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO'],
  EM_ANDAMENTO: ['AGENDADO', 'FINALIZADO', 'CANCELADO'],
  FINALIZADO: ['EM_ANDAMENTO'],
  CANCELADO: [],
}

export function transicaoPermitida(de: StatusEvento, para: StatusEvento): boolean {
  return TRANSICOES_STATUS[de].includes(para)
}

export const alterarStatusSchema = z
  .object({ status: z.enum(StatusEvento, { error: 'Escolha um status válido.' }) })
  .strict()

export type AlterarStatus = z.infer<typeof alterarStatusSchema>
