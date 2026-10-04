import { EmailProvider, type MensagemEmailComRemetente } from '../email-provider'

/** Guarda as mensagens em memória (`EMAIL_PROVIDER=fake`, testes — convenções §9). */
export class FakeEmailProvider extends EmailProvider {
  private mensagens: MensagemEmailComRemetente[] = []
  private falha: Error | null = null

  enviar(mensagem: MensagemEmailComRemetente): Promise<void> {
    if (this.falha) return Promise.reject(this.falha)
    this.mensagens.push({ ...mensagem })
    return Promise.resolve()
  }

  /** Mensagens enviadas desde o último `limpar()`, da mais antiga para a mais recente. */
  ultimos(): MensagemEmailComRemetente[] {
    return [...this.mensagens]
  }

  /** Faz os próximos envios falharem com `erro` (ou volta ao normal com `null`). */
  simularFalha(erro: Error | null = new Error('Falha simulada no envio de e-mail')): void {
    this.falha = erro
  }

  limpar(): void {
    this.mensagens = []
    this.falha = null
  }
}
