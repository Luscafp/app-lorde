import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import * as Sentry from '@sentry/nestjs'
import { ContextoAtletica } from '../../../infra/contexto/contexto-atletica.service'
import type { EventosDominio } from '../../../infra/eventos/eventos-dominio'
import { VerificacaoEmailService } from './verificacao-email.service'

/** UC06 passo 5: o cadastro não espera nem falha por causa deste envio. */
@Injectable()
export class VerificacaoEmailOuvinte {
  private readonly logger = new Logger(VerificacaoEmailOuvinte.name)

  constructor(
    private readonly verificacao: VerificacaoEmailService,
    private readonly contexto: ContextoAtletica,
  ) {}

  @OnEvent('usuario.cadastrado', { async: true })
  async aoCadastrar({
    usuarioId,
    atleticaId,
  }: EventosDominio['usuario.cadastrado']): Promise<void> {
    try {
      await this.contexto.executarComAtletica(atleticaId, () =>
        this.verificacao.enviarCodigo({ id: usuarioId, atleticaId }),
      )
    } catch (erro) {
      this.logger.error({ err: erro, usuarioId }, 'Falha ao enviar o código de verificação')
      Sentry.captureException(erro, { tags: { modulo: 'verificacao-email' }, extra: { usuarioId } })
    }
  }
}
