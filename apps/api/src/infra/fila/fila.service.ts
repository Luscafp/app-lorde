import { FUSO_PADRAO } from '@atletica/shared'
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import PgBoss from 'pg-boss'
import type { Env } from '../../config/env.schema'
import { ContextoAtletica } from '../contexto/contexto-atletica.service'
import { capturarErroJob } from '../sentry/sentry'
import { executarJob, type HandlerFila } from './executar-job'
import type { FilasDominio, NomeFila } from './filas-dominio'

/** Schema próprio do pg-boss, fora do Prisma (épico #36 §8). */
export const SCHEMA_FILA = 'pgboss'
/** Espera máxima pelos jobs em execução no encerramento (SIGTERM). */
export const TEMPO_ENCERRAMENTO_MS = 30_000

export type OpcoesFila = Pick<
  PgBoss.Queue,
  | 'policy'
  | 'retryLimit'
  | 'retryDelay'
  | 'retryBackoff'
  | 'retryDelayMax'
  | 'expireInSeconds'
  | 'retentionSeconds'
  | 'deleteAfterSeconds'
  | 'deadLetter'
>

export type OpcoesEnvio = Pick<
  PgBoss.SendOptions,
  | 'startAfter'
  | 'singletonKey'
  | 'singletonSeconds'
  | 'retryLimit'
  | 'retryDelay'
  | 'retryBackoff'
  | 'priority'
  | 'expireInSeconds'
>

export interface OpcoesTrabalho {
  batchSize?: number
}

export interface OpcoesAgendamento<T> {
  /** Padrão `FUSO_PADRAO` (America/Fortaleza). */
  tz?: string
  payload?: T
}

/** Único dono do pg-boss (convenções §11.6); workers no mesmo processo da API (épico #36 §9). */
@Injectable()
export class FilaService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(FilaService.name)
  private readonly workersAtivos: boolean
  private readonly instancia: PgBoss
  private inicio?: Promise<PgBoss>
  private readonly workerIds: string[] = []

  constructor(
    config: ConfigService<Env, true>,
    private readonly contexto: ContextoAtletica,
  ) {
    this.workersAtivos = config.get('FILA_WORKERS_ATIVOS', { infer: true })
    this.instancia = new PgBoss({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      schema: SCHEMA_FILA,
      application_name: 'atletica-api-fila',
      schedule: this.workersAtivos,
      supervise: this.workersAtivos,
    })
    this.instancia.on('error', (erro) => {
      this.logger.error({ err: erro }, 'Erro no pg-boss')
      capturarErroJob('pg-boss', erro)
    })
    this.instancia.on('warning', ({ message, data }) => this.logger.warn({ data }, message))
  }

  async onModuleInit(): Promise<void> {
    await this.boss()
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.inicio) return
    await this.inicio
    await this.instancia.stop({ graceful: true, timeout: TEMPO_ENCERRAMENTO_MS })
  }

  /** Idempotente; a política não muda depois de criada, as demais opções são atualizadas. */
  async criarFila(nome: NomeFila, opcoes: OpcoesFila = {}): Promise<void> {
    const boss = await this.boss()
    const { policy: _policy, ...ajustaveis } = opcoes
    await boss.createQueue(nome, { ...opcoes })
    if (Object.keys(ajustaveis).length > 0) await boss.updateQueue(nome, ajustaveis)
  }

  /** Devolve o id do job, ou `null` quando a política descartou o envio pela `singletonKey`. */
  async enviar<K extends NomeFila>(
    nome: K,
    payload: FilasDominio[K],
    opcoes: OpcoesEnvio = {},
  ): Promise<string | null> {
    const boss = await this.boss()
    return boss.send(nome, payload, opcoes)
  }

  async trabalhar<K extends NomeFila>(
    nome: K,
    handler: HandlerFila<FilasDominio[K]>,
    { batchSize = 1 }: OpcoesTrabalho = {},
  ): Promise<void> {
    if (!this.workersAtivos) return
    const boss = await this.boss()
    const dependencias = { contexto: this.contexto, logger: this.logger }
    const id = await boss.work<FilasDominio[K]>(
      nome,
      { batchSize, includeMetadata: true },
      async (jobs) => {
        const resultados = await Promise.allSettled(
          jobs.map((job) => executarJob(job, handler, dependencias)),
        )
        // O pg-boss conclui os jobs ainda ativos; os que falharam são marcados um a um.
        for (const [indice, resultado] of resultados.entries()) {
          const job = jobs[indice]
          if (resultado.status === 'rejected' && job) {
            await boss.fail(nome, job.id, resultado.reason as object)
          }
        }
      },
    )
    this.workerIds.push(id)
  }

  async agendar<K extends NomeFila>(
    nome: K,
    cron: string,
    { tz = FUSO_PADRAO, payload }: OpcoesAgendamento<FilasDominio[K]> = {},
  ): Promise<void> {
    if (!this.workersAtivos) return
    const boss = await this.boss()
    await boss.schedule(nome, cron, payload, { tz })
  }

  /** Antecipa a próxima busca dos workers (usado pelos utilitários de teste). */
  acordarWorkers(): void {
    for (const id of this.workerIds) this.instancia.notifyWorker(id)
  }

  private boss(): Promise<PgBoss> {
    this.inicio ??= this.instancia.start()
    return this.inicio
  }
}
