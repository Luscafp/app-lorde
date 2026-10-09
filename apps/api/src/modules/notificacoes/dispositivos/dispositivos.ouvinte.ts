import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import * as Sentry from '@sentry/nestjs'
import type { EventosDominio } from '../../../infra/eventos/eventos-dominio'
import { DispositivosService } from './dispositivos.service'

/** UC08 passo 3: aparelho da sessão encerrada para de receber push (épico #36 §3.2 item 7). */
@Injectable()
export class DispositivosOuvinte {
  private readonly logger = new Logger(DispositivosOuvinte.name)

  constructor(private readonly dispositivos: DispositivosService) {}

  @OnEvent('usuario.sessaoEncerrada', { async: true })
  async aoEncerrarSessao({
    usuarioId,
    sessaoIds,
    motivo,
  }: EventosDominio['usuario.sessaoEncerrada']): Promise<void> {
    try {
      const removidos =
        motivo === 'CONTA_EXCLUIDA'
          ? await this.dispositivos.removerTodosDoUsuario(usuarioId)
          : await this.dispositivos.removerDasSessoes(usuarioId, sessaoIds)
      this.logger.log({ usuarioId, motivo, dispositivos: removidos }, 'Dispositivos removidos')
    } catch (erro) {
      this.logger.error({ err: erro, usuarioId }, 'Falha ao remover dispositivos da sessão')
      Sentry.captureException(erro, { tags: { modulo: 'notificacoes' }, extra: { usuarioId } })
    }
  }
}
