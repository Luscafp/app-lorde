import * as Sentry from '@sentry/react-native'
import type { Breadcrumb, ErrorEvent, ReactNativeOptions } from '@sentry/react-native'
import * as Application from 'expo-application'
import { ambiente } from '@/config/ambiente'
import { definirRegistrador } from '@/infra/api/cliente'
import { useSessao } from '@/infra/sessao/store'

const REGEX_EMAIL = /[^@\s]+@[^@\s]+/g
const CATEGORIAS_HTTP = new Set(['http', 'fetch', 'xhr'])
const CHAVES_SEGREDO = new Set(['authorization'])
const CHAVES_HTTP = new Set([
  ...CHAVES_SEGREDO,
  'body',
  'request_body',
  'response_body',
  'requestbody',
  'responsebody',
])

/** Rotas do Expo Router como nome de transação (`eventos/[id]`, sem parâmetros). */
export const integracaoNavegacao = Sentry.reactNavigationIntegration()

function semChaves(valor: unknown, removidas: Set<string>): unknown {
  if (Array.isArray(valor)) return valor.map((item) => semChaves(item, removidas))
  if (typeof valor === 'object' && valor !== null) {
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([chave]) => !removidas.has(chave.toLowerCase()))
        .map(([chave, item]) => [chave, semChaves(item, removidas)]),
    )
  }
  return valor
}

function ocultarEmails<T>(valor: T): T {
  if (typeof valor === 'string') return valor.replace(REGEX_EMAIL, '[email]') as T
  if (Array.isArray(valor)) return valor.map(ocultarEmails) as T
  if (typeof valor === 'object' && valor !== null) {
    return Object.fromEntries(
      Object.entries(valor).map(([chave, item]) => [chave, ocultarEmails(item)]),
    ) as T
  }
  return valor
}

/** Sem cabeçalho `Authorization` e, nas requisições HTTP, sem corpo. */
export function beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (!breadcrumb.data) return breadcrumb
  const removidas = CATEGORIAS_HTTP.has(breadcrumb.category ?? '') ? CHAVES_HTTP : CHAVES_SEGREDO
  return { ...breadcrumb, data: semChaves(breadcrumb.data, removidas) as Breadcrumb['data'] }
}

/** E-mails viram `[email]`; usuário só com `id` (épico #5 §3 item 7, §6). */
export function beforeSend(evento: ErrorEvent): ErrorEvent {
  if (evento.message) evento.message = ocultarEmails(evento.message)
  if (evento.extra) evento.extra = ocultarEmails(evento.extra)
  if (evento.breadcrumbs) evento.breadcrumbs = ocultarEmails(evento.breadcrumbs)
  for (const excecao of evento.exception?.values ?? []) {
    if (excecao.value) excecao.value = ocultarEmails(excecao.value)
  }
  if (evento.user) evento.user = evento.user.id === undefined ? undefined : { id: evento.user.id }
  return evento
}

/** Mesmo formato do EAS/`sentry-cli` (`<id>@<versão>+<build>`), para casar com os source maps. */
function versaoSentry(): Pick<ReactNativeOptions, 'release' | 'dist'> {
  const { applicationId, nativeApplicationVersion, nativeBuildVersion } = Application
  if (!applicationId || !nativeApplicationVersion || !nativeBuildVersion) return {}
  return {
    release: `${applicationId}@${nativeApplicationVersion}+${nativeBuildVersion}`,
    dist: nativeBuildVersion,
  }
}

/** Opções do `Sentry.init`; `undefined` sem DSN (Sentry desligado). */
export function opcoesSentry(dsn = ambiente.sentryDsn): ReactNativeOptions | undefined {
  if (!dsn) return undefined
  return {
    dsn,
    environment: ambiente.nome,
    ...versaoSentry(),
    enabled: !__DEV__,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    integrations: [integracaoNavegacao],
    beforeBreadcrumb,
    beforeSend,
  }
}

/** Sentry só com o `id` do usuário, acompanhando a store de sessão. Devolve o cancelamento. */
export function acompanharUsuario(): () => void {
  const aplicar = ({ status, usuario }: ReturnType<typeof useSessao.getState>) => {
    if (status === 'autenticado' && usuario) Sentry.setUser({ id: usuario.id })
    else if (status === 'anonimo') Sentry.setUser(null)
  }
  aplicar(useSessao.getState())
  return useSessao.subscribe((estado, anterior) => {
    if (estado.status !== anterior.status || estado.usuario?.id !== anterior.usuario?.id) {
      aplicar(estado)
    }
  })
}

export function iniciarSentry(dsn = ambiente.sentryDsn): void {
  const opcoes = opcoesSentry(dsn)
  if (!opcoes) return
  Sentry.init(opcoes)
  definirRegistrador((mensagem, contexto) =>
    Sentry.captureMessage(mensagem, { level: 'warning', extra: contexto }),
  )
  acompanharUsuario()
}
