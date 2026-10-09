import type { MensagemPush } from '../../modules/notificacoes/envio/cliente-expo-push'

/** Nome (`dominio.acao-kebab`, convenções §2) → payload; cada issue acrescenta as suas filas. */
export interface FilasDominio {
  /** #87: um lote de até 100 mensagens; `dispositivoIds[i]` é o aparelho de `mensagens[i]`. */
  'notificacao.enviar-lote': { mensagens: MensagemPush[]; dispositivoIds: string[] }
  /** #87: tickets aceitos pelo Expo, consultados 15 min depois do envio. */
  'notificacao.recibos': { tickets: { ticketId: string; dispositivoId: string }[] }
  /** #87: cron diário 04:00. */
  'dispositivos.limpeza': Record<string, never>
}

export type NomeFila = Extract<keyof FilasDominio, string>
