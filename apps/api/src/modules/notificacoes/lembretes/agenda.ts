import { ANTECEDENCIAS } from '@atletica/shared'
import { DIA_MS, HORA_MS } from '../../../common/tempo'
import type { StatusEvento } from '../../../generated/prisma/client'

export const FILA_RECONCILIAR = 'notificacao.reconciliar'
export const FILA_LEMBRETE = 'notificacao.lembrete'
export const FILA_CONFIRMACAO_PENDENTE = 'notificacao.confirmacao-pendente'
export const CRON_RECONCILIACAO = '*/15 * * * *'
export const JANELA_RECONCILIACAO_MS = 2 * DIA_MS
export const ANTECEDENCIA_CONFIRMACAO_HORAS = 24

export interface EventoAgendavel {
  id: string
  inicio: Date
  criadoEm: Date
}

export type FilaAgendada = typeof FILA_LEMBRETE | typeof FILA_CONFIRMACAO_PENDENTE

const TIPO_JOB: Record<FilaAgendada, string> = {
  [FILA_LEMBRETE]: 'lembrete',
  [FILA_CONFIRMACAO_PENDENTE]: 'confirmacao-pendente',
}

export interface JobPlanejado {
  fila: FilaAgendada
  horas: number
  startAfter: Date
  singletonKey: string
}

export interface EventoNaExecucao {
  status: StatusEvento
  excluidoEm: Date | null
  inicio: Date
}

export type MotivoDescarte = 'inexistente' | 'excluido' | 'status' | 'inicio-alterado' | 'iniciado'

/** `"<tipo>:<eventoId>:<h>:<inicioISO>"`: mudar o início gera chaves novas (épico #36 §3.5). */
export function chaveJob(
  fila: FilaAgendada,
  eventoId: string,
  horas: number,
  inicio: Date,
): string {
  return `${TIPO_JOB[fila]}:${eventoId}:${horas}:${inicio.toISOString()}`
}

/** Épico #36 §3.5 item 13: criado com menos de 24 h de antecedência não recebe "Você vai?". */
export function recebeConfirmacaoPendente({ inicio, criadoEm }: EventoAgendavel): boolean {
  return inicio.getTime() - criadoEm.getTime() >= ANTECEDENCIA_CONFIRMACAO_HORAS * HORA_MS
}

/** 4 lembretes e 1 confirmação pendente, pulando os horários que já passaram. */
export function planejarJobs(evento: EventoAgendavel, agora: Date): JobPlanejado[] {
  const planejar = (fila: FilaAgendada, horas: number): JobPlanejado => ({
    fila,
    horas,
    startAfter: new Date(evento.inicio.getTime() - horas * HORA_MS),
    singletonKey: chaveJob(fila, evento.id, horas, evento.inicio),
  })
  const jobs = ANTECEDENCIAS.map((horas) => planejar(FILA_LEMBRETE, horas))
  if (recebeConfirmacaoPendente(evento)) {
    jobs.push(planejar(FILA_CONFIRMACAO_PENDENTE, ANTECEDENCIA_CONFIRMACAO_HORAS))
  }
  return jobs.filter(({ startAfter }) => startAfter > agora)
}

/** Alteração e cancelamento não cancelam jobs: o job antigo se descarta aqui. */
export function motivoDescarte(
  evento: EventoNaExecucao | null,
  inicioPrevisto: string,
  agora: Date,
): MotivoDescarte | null {
  if (!evento) return 'inexistente'
  if (evento.excluidoEm) return 'excluido'
  if (evento.status !== 'AGENDADO') return 'status'
  if (evento.inicio.toISOString() !== inicioPrevisto) return 'inicio-alterado'
  if (evento.inicio <= agora) return 'iniciado'
  return null
}
