/** Tela aberta ao tocar a notificação (épico #36 §3.4). */
export type DestinoNotificacao =
  | { tela: 'inicio' }
  | { tela: 'evento'; id: string }
  | { tela: 'noticia'; id: string }
  | { tela: 'time'; id: string }
  | { tela: 'solicitacoes' }
  | { tela: 'perfil' }

/** Lista permitida de `data.url`: fora dela, o app abre a Home. */
export const ROTAS_NOTIFICACAO_PERMITIDAS: readonly RegExp[] = [
  /^\/$/,
  /^\/eventos\/[0-9a-f-]{36}$/,
  /^\/noticias\/[0-9a-f-]{36}$/,
  /^\/times\/[0-9a-f-]{36}$/,
  /^\/painel\/solicitacoes$/,
  /^\/perfil$/,
]

export function rotaNotificacaoPermitida(url: unknown): url is string {
  return typeof url === 'string' && ROTAS_NOTIFICACAO_PERMITIDAS.some((rota) => rota.test(url))
}

function caminho(destino: DestinoNotificacao): string {
  switch (destino.tela) {
    case 'inicio':
      return '/'
    case 'evento':
      return `/eventos/${destino.id}`
    case 'noticia':
      return `/noticias/${destino.id}`
    case 'time':
      return `/times/${destino.id}`
    case 'solicitacoes':
      return '/painel/solicitacoes'
    case 'perfil':
      return '/perfil'
  }
}

/** Monta o `data.url` da notificação; lança se o resultado sair da lista permitida (id inválido). */
export function rotaNotificacao(destino: DestinoNotificacao): string {
  const url = caminho(destino)
  if (!rotaNotificacaoPermitida(url)) {
    throw new Error(`Rota de notificação inválida para a tela ${destino.tela}.`)
  }
  return url
}
