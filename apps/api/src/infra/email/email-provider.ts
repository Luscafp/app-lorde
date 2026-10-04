/** Mensagem pronta para envio; `html` e `texto` vêm de `renderizar` (templates/base.ts). */
export interface MensagemEmail {
  para: string
  assunto: string
  html: string
  texto: string
}

/** Mensagem entregue ao provider, já com o remetente (`EMAIL_REMETENTE`). */
export interface MensagemEmailComRemetente extends MensagemEmail {
  de: string
}

/**
 * Provider de envio, escolhido por `EMAIL_PROVIDER`. Também é o token de injeção:
 * nos testes, `app.get(EmailProvider)` devolve o `FakeEmailProvider`.
 */
export abstract class EmailProvider {
  /** Rejeita a promessa quando o envio falha; o `EmailService` loga e reporta. */
  abstract enviar(mensagem: MensagemEmailComRemetente): Promise<void>
}
