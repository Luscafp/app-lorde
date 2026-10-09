import { Expo } from 'expo-server-sdk'
import {
  ClienteExpoPush,
  type MensagemPush,
  type ReciboPush,
  type TicketPush,
} from './cliente-expo-push'

/** `expo-server-sdk` (repete sozinho o 429; rede e 5xx voltam ao job). */
export class ExpoPushCliente extends ClienteExpoPush {
  private readonly expo: Expo

  constructor(accessToken?: string) {
    super()
    this.expo = new Expo(accessToken ? { accessToken } : {})
  }

  enviar(mensagens: MensagemPush[]): Promise<TicketPush[]> {
    return this.expo.sendPushNotificationsAsync(mensagens)
  }

  consultarRecibos(ticketIds: string[]): Promise<Record<string, ReciboPush>> {
    return this.expo.getPushNotificationReceiptsAsync(ticketIds)
  }
}
