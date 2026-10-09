import type { ExpoPushReceipt, ExpoPushTicket } from 'expo-server-sdk'
import type { MensagemPush } from '../../../infra/fila/filas-dominio'

export type TicketPush = ExpoPushTicket

export type ReciboPush = ExpoPushReceipt

/** Expo Push Service: `SdkExpoPush` real ou `FakeExpoPush` nos testes (convenções §9). */
export abstract class ClienteExpoPush {
  /** Até 100 mensagens; o n-ésimo ticket é da n-ésima mensagem. */
  abstract enviar(mensagens: MensagemPush[]): Promise<TicketPush[]>

  /** Até 1000 ids; ticket ainda sem recibo fica de fora. */
  abstract consultarRecibos(ticketIds: string[]): Promise<Record<string, ReciboPush>>
}
