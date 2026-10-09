import {
  ClienteExpoPush,
  type MensagemPush,
  type ReciboPush,
  type TicketPush,
} from './cliente-expo-push'

type ErroPush = NonNullable<
  NonNullable<Extract<ReciboPush, { status: 'error' }>['details']>['error']
>

/** Erros do Expo tratados pela API; `MismatchSenderId` não está no tipo do SDK. */
export type ErroSimulado = ErroPush | 'MismatchSenderId'

function erroDoExpo(erro: ErroSimulado): Extract<ReciboPush, { status: 'error' }> {
  return { status: 'error', message: erro, details: { error: erro as ErroPush } }
}

/** Expo em memória, selecionado com `NODE_ENV=test` (convenções §9). */
export class FakeExpoPush extends ClienteExpoPush {
  private requisicoesFeitas: MensagemPush[][] = []
  private falhasPendentes = 0
  private readonly errosTicket = new Map<string, ErroSimulado>()
  private readonly errosRecibo = new Map<string, ErroSimulado>()
  private readonly tokenDoTicket = new Map<string, string>()
  private sequencia = 0

  enviar(mensagens: MensagemPush[]): Promise<TicketPush[]> {
    if (this.falhasPendentes > 0) {
      this.falhasPendentes -= 1
      return Promise.reject(Object.assign(new Error('Expo indisponível'), { statusCode: 503 }))
    }
    this.requisicoesFeitas.push(mensagens.map((mensagem) => structuredClone(mensagem)))
    return Promise.resolve(mensagens.map(({ to }) => this.ticket(to)))
  }

  consultarRecibos(ticketIds: string[]): Promise<Record<string, ReciboPush>> {
    const recibos: Record<string, ReciboPush> = {}
    for (const id of ticketIds) {
      const token = this.tokenDoTicket.get(id)
      if (token === undefined) continue
      const erro = this.errosRecibo.get(token)
      recibos[id] = erro ? erroDoExpo(erro) : { status: 'ok' }
    }
    return Promise.resolve(recibos)
  }

  /** Mensagens aceitas, na ordem de envio. */
  enviadas(): MensagemPush[] {
    return this.requisicoesFeitas.flat()
  }

  /** Uma entrada por requisição aceita, com as mensagens do lote. */
  requisicoes(): MensagemPush[][] {
    return this.requisicoesFeitas.map((lote) => [...lote])
  }

  /** As próximas `vezes` requisições de envio falham com 503. */
  simularIndisponibilidade(vezes = 1): void {
    this.falhasPendentes = vezes
  }

  simularErroTicket(tokenPush: string, erro: ErroSimulado): void {
    this.errosTicket.set(tokenPush, erro)
  }

  simularErroRecibo(tokenPush: string, erro: ErroSimulado): void {
    this.errosRecibo.set(tokenPush, erro)
  }

  limpar(): void {
    this.requisicoesFeitas = []
    this.falhasPendentes = 0
    this.errosTicket.clear()
    this.errosRecibo.clear()
    this.tokenDoTicket.clear()
  }

  private ticket(token: string): TicketPush {
    const erro = this.errosTicket.get(token)
    if (erro) return erroDoExpo(erro)
    this.sequencia += 1
    const id = `ticket-${this.sequencia}`
    this.tokenDoTicket.set(id, token)
    return { status: 'ok', id }
  }
}
