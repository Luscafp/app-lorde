import { Resend } from 'resend'
import { EmailProvider, type MensagemEmailComRemetente } from '../email-provider'

/** Tempo máximo da chamada HTTP ao Resend (épico #11 §9). */
export const TIMEOUT_RESEND_MS = 10_000

/** Envio real pelo Resend (`EMAIL_PROVIDER=resend`, homologação e produção). */
export class ResendEmailProvider extends EmailProvider {
  private readonly cliente: Resend

  constructor(apiKey: string) {
    super()
    this.cliente = new Resend(apiKey)
  }

  async enviar({ de, para, assunto, html, texto }: MensagemEmailComRemetente): Promise<void> {
    // O SDK devolve `{ error }` em vez de lançar; o timeout aborta a requisição (lança).
    const { error } = await this.cliente.emails.send(
      { from: de, to: para, subject: assunto, html, text: texto },
      { signal: AbortSignal.timeout(TIMEOUT_RESEND_MS) },
    )
    if (error) {
      throw new Error(`Resend recusou o envio (${error.name}): ${error.message}`)
    }
  }
}
