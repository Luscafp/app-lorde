import { Injectable, Logger } from '@nestjs/common'
import { commitApi, VERSAO_API } from '../../config/versao'
import { PrismaService } from '../../infra/prisma/prisma.service'
import type { RespostaHealth } from './health.dto'

export const TIMEOUT_BANCO_MS = 2000

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name)

  constructor(private readonly prisma: PrismaService) {}

  async verificar(): Promise<RespostaHealth> {
    const identificacao = { versao: VERSAO_API, commit: commitApi() ?? 'desconhecido' }
    return (await this.bancoResponde())
      ? { status: 'ok', ...identificacao, banco: 'ok' }
      : { status: 'erro', ...identificacao, banco: 'indisponivel' }
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
