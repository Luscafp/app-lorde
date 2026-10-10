import {
  formatarData,
  formatarHora,
  type CategoriaNotificacao,
  type Instante,
} from '@atletica/shared'
import type { MensagemPush } from '../../../infra/fila/filas-dominio'

/** Limite de mensagens por requisição ao Expo. */
export const TAMANHO_LOTE = 100
export const LIMITE_TITULO = 65
export const LIMITE_CORPO = 180

export interface ConteudoNotificacao {
  categoria: CategoriaNotificacao
  titulo: string
  corpo: string
  url: string
  chave: string
  /** Segundos de validade (lembretes: até o início do evento). */
  ttl?: number
}

/** Conta caracteres, não unidades UTF-16; o excedente vira reticências. */
export function truncar(texto: string, limite: number): string {
  const caracteres = Array.from(texto.trim())
  if (caracteres.length <= limite) return caracteres.join('')
  return `${caracteres
    .slice(0, limite - 1)
    .join('')
    .trimEnd()}…`
}

/** `"12/10 19:00"` no fuso padrão, para títulos e corpos. */
export function formatarDataCurta(instante: Instante): string {
  return `${formatarData(instante).slice(0, 5)} ${formatarHora(instante)}`
}

export function montarMensagem(tokenPush: string, conteudo: ConteudoNotificacao): MensagemPush {
  return {
    to: tokenPush,
    title: truncar(conteudo.titulo, LIMITE_TITULO),
    body: truncar(conteudo.corpo, LIMITE_CORPO),
    data: { url: conteudo.url, tipo: conteudo.categoria, id: conteudo.chave },
    channelId: 'padrao',
    sound: 'default',
    priority: 'high',
    ...(conteudo.ttl !== undefined && { ttl: conteudo.ttl }),
  }
}

export function dividirEmLotes<T>(itens: readonly T[], tamanho = TAMANHO_LOTE): T[][] {
  const lotes: T[][] = []
  for (let inicio = 0; inicio < itens.length; inicio += tamanho) {
    lotes.push(itens.slice(inicio, inicio + tamanho))
  }
  return lotes
}
