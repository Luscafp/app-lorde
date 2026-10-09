import type { ExpoPushReceipt, ExpoPushTicket } from 'expo-server-sdk'

/** Mensagem para um único aparelho (épico #36 §9); vai inteira no payload do job. */
export interface MensagemPush {
  to: string
  title: string
  body: string
  data: { url: string; tipo: string; id: string }
  channelId: 'padrao'
  sound: 'default'
  priority: 'high'
  ttl?: number
}

export type TicketPush = ExpoPushTicket

export type ReciboPush = ExpoPushReceipt

/** Expo Push Service: `ExpoPushCliente` real ou `FakeExpoPush` nos testes (convenções §9). */
export abstract class ClienteExpoPush {
  /** Até 100 mensagens; o n-ésimo ticket é da n-ésima mensagem. */
  abstract enviar(mensagens: MensagemPush[]): Promise<TicketPush[]>

  /** Até 1000 ids; ticket ainda sem recibo fica de fora. */
  abstract consultarRecibos(ticketIds: string[]): Promise<Record<string, ReciboPush>>
}
