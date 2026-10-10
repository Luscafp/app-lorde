import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import * as Sentry from '@sentry/nestjs'
import type { Prisma } from '../../../generated/prisma/client'
import type { EventosDominio } from '../../../infra/eventos/eventos-dominio'
import { LembretesService } from './lembretes.service'

/** Reconcilia na hora os eventos afetados; o cron de 15 min cobre o que escapar (épico #36 §3.5). */
@Injectable()
export class LembretesOuvinte {
  private readonly logger = new Logger(LembretesOuvinte.name)

  constructor(private readonly lembretes: LembretesService) {}

  /** Série: todas as ocorrências na janela, não só a 1ª do payload. */
  @OnEvent('evento.criado', { async: true })
  async aoCriarEvento({
    atleticaId,
    eventoId,
    serieId,
  }: EventosDominio['evento.criado']): Promise<void> {
    await this.reconciliar(atleticaId, serieId ? { serieId } : { id: eventoId })
  }

  /** Só status: o job antigo se descarta na execução, não há o que agendar. */
  @OnEvent('evento.alterado', { async: true })
  async aoAlterarEvento({
    atleticaId,
    eventoIds,
    campos,
  }: EventosDominio['evento.alterado']): Promise<void> {
    if (campos.length > 0 && campos.every((campo) => campo === 'status')) return
    await this.reconciliar(atleticaId, { id: { in: eventoIds } })
  }

  private async reconciliar(atleticaId: string, filtro: Prisma.EventoWhereInput): Promise<void> {
    try {
      const criados = await this.lembretes.reconciliarEventos(atleticaId, filtro)
      this.logger.log({ atleticaId, criados }, 'Lembretes dos eventos afetados agendados')
    } catch (erro) {
      this.logger.error({ err: erro, atleticaId }, 'Falha ao agendar lembretes')
      Sentry.captureException(erro, { tags: { modulo: 'notificacoes' }, extra: { atleticaId } })
    }
  }
}
