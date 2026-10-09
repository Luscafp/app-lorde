import type { LoggerService } from '@nestjs/common'
import type PgBoss from 'pg-boss'
import type { ContextoAtletica } from '../contexto/contexto-atletica.service'
import { capturarErroJob } from '../sentry/sentry'

export type JobFila<T> = PgBoss.JobWithMetadata<T>

export type HandlerFila<T> = (payload: T, job: JobFila<T>) => Promise<void>

export interface DependenciasJob {
  contexto: Pick<ContextoAtletica, 'executarComAtletica'>
  logger: Pick<LoggerService, 'log' | 'warn' | 'error'>
}

function atleticaDoPayload(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null || !('atleticaId' in payload))
    return undefined
  return typeof payload.atleticaId === 'string' ? payload.atleticaId : undefined
}

/** A tentativa n tem `retryCount = n - 1`; o pg-boss desiste quando `retryCount` chega ao limite. */
export function ehUltimaTentativa(
  job: Pick<JobFila<unknown>, 'retryCount' | 'retryLimit'>,
): boolean {
  return job.retryCount >= job.retryLimit
}

/** Relança o erro para o pg-boss registrar a falha e agendar o retry. */
export async function executarJob<T>(
  job: JobFila<T>,
  handler: HandlerFila<T>,
  { contexto, logger }: DependenciasJob,
): Promise<void> {
  const atleticaId = atleticaDoPayload(job.data)
  const dados = { fila: job.name, jobId: job.id, tentativa: job.retryCount + 1 }
  try {
    if (atleticaId) await contexto.executarComAtletica(atleticaId, () => handler(job.data, job))
    else await handler(job.data, job)
    logger.log(dados, 'Job concluído')
  } catch (erro) {
    if (ehUltimaTentativa(job)) {
      logger.error({ ...dados, err: erro }, 'Job falhou na última tentativa')
      capturarErroJob(job.name, erro, { jobId: job.id, tentativa: dados.tentativa })
    } else {
      logger.warn({ ...dados, err: erro }, 'Job falhou; nova tentativa agendada')
    }
    throw erro
  }
}
