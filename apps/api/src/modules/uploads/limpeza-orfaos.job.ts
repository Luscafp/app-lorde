import { FUSO_PADRAO } from '@atletica/shared'
import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { JOB_LIMPEZA_ORFAOS, LimpezaOrfaosService } from './limpeza-orfaos.service'

/** Agenda a limpeza de órfãos; o `ScheduleModule` é registrado pelo `AgendadorModule` (#58). */
@Injectable()
export class LimpezaOrfaosJob {
  private readonly logger = new Logger(LimpezaOrfaosJob.name)
  private emExecucao = false

  constructor(private readonly limpeza: LimpezaOrfaosService) {}

  @Cron('30 3 * * *', { name: JOB_LIMPEZA_ORFAOS, timeZone: FUSO_PADRAO })
  async executar(): Promise<void> {
    if (this.emExecucao) {
      this.logger.warn({ job: JOB_LIMPEZA_ORFAOS }, 'Limpeza de órfãos já em execução')
      return
    }
    this.emExecucao = true
    try {
      await this.limpeza.executar()
    } catch (erro) {
      this.logger.error({ err: erro, job: JOB_LIMPEZA_ORFAOS }, 'Falha na limpeza de órfãos')
    } finally {
      this.emExecucao = false
    }
  }
}
