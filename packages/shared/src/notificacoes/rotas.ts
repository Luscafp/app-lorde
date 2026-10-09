/** Tela aberta ao tocar a notificação (épico #36 §3.4). */
export type DestinoNotificacao =
  | { tela: 'inicio' }
  | { tela: 'evento'; id: string }
  | { tela: 'noticia'; id: string }
  | { tela: 'time'; id: string }
  | { tela: 'solicitacoes' }
  | { tela: 'perfil' }

type Tela = DestinoNotificacao['tela']

interface Rota<T extends Tela> {
  padrao: RegExp
  caminho: (destino: Extract<DestinoNotificacao, { tela: T }>) => string
}

/** Único lugar para acrescentar uma tela: caminho e regex da lista permitida juntos. */
const ROTAS: { readonly [T in Tela]: Rota<T> } = {
  inicio: { padrao: /^\/$/, caminho: () => '/' },
  evento: { padrao: /^\/eventos\/[0-9a-f-]{36}$/, caminho: ({ id }) => `/eventos/${id}` },
  noticia: { padrao: /^\/noticias\/[0-9a-f-]{36}$/, caminho: ({ id }) => `/noticias/${id}` },
  time: { padrao: /^\/times\/[0-9a-f-]{36}$/, caminho: ({ id }) => `/times/${id}` },
  solicitacoes: { padrao: /^\/painel\/solicitacoes$/, caminho: () => '/painel/solicitacoes' },
  perfil: { padrao: /^\/perfil$/, caminho: () => '/perfil' },
}

/** Lista permitida de `data.url`: fora dela, o app abre a Home. */
export const ROTAS_NOTIFICACAO_PERMITIDAS: readonly RegExp[] = Object.values(ROTAS).map(
  ({ padrao }) => padrao,
)

export function rotaNotificacaoPermitida(url: unknown): url is string {
  return typeof url === 'string' && ROTAS_NOTIFICACAO_PERMITIDAS.some((rota) => rota.test(url))
}

/** Monta o `data.url` da notificação; lança se o resultado sair da lista permitida (id inválido). */
export function rotaNotificacao(destino: DestinoNotificacao): string {
  const { caminho } = ROTAS[destino.tela] as Rota<Tela>
  const url = caminho(destino)
  if (!rotaNotificacaoPermitida(url)) {
    throw new Error(`Rota de notificação inválida para a tela ${destino.tela}.`)
  }
  return url
}
