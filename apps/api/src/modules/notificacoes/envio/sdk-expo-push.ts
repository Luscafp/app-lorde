import { Expo } from 'expo-server-sdk'
import type { MensagemPush } from '../../../infra/fila/filas-dominio'
import { ClienteExpoPush, type ReciboPush, type TicketPush } from './cliente-expo-push'

/** `expo-server-sdk` (repete sozinho o 429; rede e 5xx voltam ao job). */
export class SdkExpoPush extends ClienteExpoPush {
  private readonly expo: Expo

  constructor(tokenAcesso?: string) {
    super()
    this.expo = new Expo(tokenAcesso ? { accessToken: tokenAcesso } : {})
  }

  enviar(mensagens: MensagemPush[]): Promise<TicketPush[]> {
    return this.expo.sendPushNotificationsAsync(mensagens)
  }

  consultarRecibos(ticketIds: string[]): Promise<Record<string, ReciboPush>> {
    return this.expo.getPushNotificationReceiptsAsync(ticketIds)
  }
}
