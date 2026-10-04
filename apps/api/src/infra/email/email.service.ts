import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Sentry from '@sentry/nestjs'
import type { Env } from '../../config/env.schema'
import { EmailProvider, type MensagemEmail } from './email-provider'
import { mascararEmail } from './mascarar-email'

/**
 * Envio de e-mail transacional (dono: #61). Monte `assunto`, `html` e `texto` com `renderizar`
 * (templates/base.ts). Em falha, loga com o e-mail mascarado (sem o conteúdo), reporta ao Sentry
 * e rejeita a promessa. Em rotas que não devem esperar o envio:
 * `void this.emailService.enviar(mensagem).catch(() => undefined)` (o erro já foi logado).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly remetente: string

  constructor(
    private readonly provider: EmailProvider,
    config: ConfigService<Env, true>,
  ) {
    this.remetente = config.get('EMAIL_REMETENTE', { infer: true })
  }

  async enviar(mensagem: MensagemEmail): Promise<void> {
    try {
      await this.provider.enviar({ ...mensagem, de: this.remetente })
    } catch (erro) {
      const para = mascararEmail(mensagem.para)
      this.logger.error({ err: erro, para }, 'Falha ao enviar e-mail')
      Sentry.captureException(erro, { tags: { modulo: 'email' }, extra: { para } })
      throw erro
    }
  }
}
