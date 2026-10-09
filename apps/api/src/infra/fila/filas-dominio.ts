import type { CategoriaNotificacao } from '@atletica/shared'

/** Mensagem do Expo para um aparelho (épico #36 §9); campos em inglês no formato da API do Expo. */
export interface MensagemPush {
  to: string
  title: string
  body: string
  data: { url: string; tipo: CategoriaNotificacao; id: string }
  channelId: 'padrao'
  sound: 'default'
  priority: 'high'
  ttl?: number
}

export interface EntregaPush {
  dispositivoId: string
  mensagem: MensagemPush
}

/** Nome (`dominio.acao-kebab`, convenções §2) → payload; cada issue acrescenta as suas filas. */
export interface FilasDominio {
  /** #87: um lote de até 100 entregas. */
  'notificacao.enviar-lote': { entregas: EntregaPush[] }
  /** #87: tickets aceitos pelo Expo, consultados 15 min depois do envio. */
  'notificacao.recibos': { tickets: { ticketId: string; dispositivoId: string }[] }
  /** #87: cron diário 04:00. */
  'dispositivos.limpeza': Record<string, never>
}

export type NomeFila = Extract<keyof FilasDominio, string>
