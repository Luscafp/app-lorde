import { Logger } from '@nestjs/common'
import { EmailProvider, type MensagemEmailComRemetente } from '../email-provider'
import { mascararEmail } from '../mascarar-email'

/**
 * Escreve o e-mail no log em vez de enviar (`EMAIL_PROVIDER=log`, desenvolvimento).
 * O corpo (que pode conter códigos) e o destinatário completo só aparecem com `NODE_ENV=development`.
 */
export class LogEmailProvider extends EmailProvider {
  private readonly logger = new Logger(LogEmailProvider.name)

  constructor(private readonly exibirCorpo: boolean) {
    super()
  }

  enviar({ de, para, assunto, texto }: MensagemEmailComRemetente): Promise<void> {
    const registro = this.exibirCorpo
      ? { de, para, assunto, texto }
      : { de, para: mascararEmail(para), assunto }
    this.logger.log(registro, 'E-mail não enviado (EMAIL_PROVIDER=log)')
    return Promise.resolve()
  }
}
