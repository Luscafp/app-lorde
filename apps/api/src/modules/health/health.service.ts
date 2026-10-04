import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import { commitApi, VERSAO_API } from '../../config/versao'
import { PrismaService } from '../../infra/prisma/prisma.service'
import type { RespostaSaude } from './health.dto'

export const TIMEOUT_BANCO_MS = 2000

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name)

  private readonly identificacao: { versao: string; commit: string }

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.identificacao = {
      versao: VERSAO_API,
      commit: commitApi({
        GIT_COMMIT_SHA: config.get('GIT_COMMIT_SHA', { infer: true }),
        RAILWAY_GIT_COMMIT_SHA: config.get('RAILWAY_GIT_COMMIT_SHA', { infer: true }),
      }),
    }
  }

  async verificar(): Promise<RespostaSaude> {
    return (await this.bancoResponde())
      ? { status: 'ok', ...this.identificacao, banco: 'ok' }
      : { status: 'erro', ...this.identificacao, banco: 'indisponivel' }
  }

  private async bancoResponde(): Promise<boolean> {
    let temporizador: NodeJS.Timeout | undefined
    const limite = new Promise<never>((_, rejeitar) => {
      temporizador = setTimeout(
        () => rejeitar(new Error(`SELECT 1 sem resposta em ${TIMEOUT_BANCO_MS} ms`)),
        TIMEOUT_BANCO_MS,
      )
    })
    try {
      await Promise.race([this.prisma.semEscopo.$queryRaw`SELECT 1`, limite])
      return true
    } catch (erro) {
      this.logger.warn({ err: erro }, 'Banco indisponível no health check')
      return false
    } finally {
      clearTimeout(temporizador)
    }
  }
}
