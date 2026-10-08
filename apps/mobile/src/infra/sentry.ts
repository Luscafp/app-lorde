import * as Sentry from '@sentry/react-native'
import type { Breadcrumb, ErrorEvent, ReactNativeOptions, Span } from '@sentry/react-native'
import * as Application from 'expo-application'
import { useEffect } from 'react'
import { ambiente } from '@/config/ambiente'
import { useSessao, type EstadoSessao } from '@/infra/sessao/store'

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

type Regra = { manterChave?: (chave: string) => boolean; trocarTexto?: (texto: string) => string }

function percorrer(valor: unknown, regra: Regra): unknown {
  if (typeof valor === 'string') return regra.trocarTexto?.(valor) ?? valor
  if (Array.isArray(valor)) return valor.map((item) => percorrer(item, regra))
  if (typeof valor === 'object' && valor !== null) {
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([chave]) => regra.manterChave?.(chave) ?? true)
        .map(([chave, item]) => [chave, percorrer(item, regra)]),
    )
  }
  return valor
}

function semChaves(valor: unknown, removidas: Set<string>): unknown {
  return percorrer(valor, { manterChave: (chave) => !removidas.has(chave.toLowerCase()) })
}

function ocultarEmails<T>(valor: T): T {
  return percorrer(valor, { trocarTexto: (texto) => texto.replace(REGEX_EMAIL, '[email]') }) as T
}

/** Sem cabeçalho `Authorization` e, nas requisições HTTP, sem corpo. */
export function limparBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (!breadcrumb.data) return breadcrumb
  const removidas = CATEGORIAS_HTTP.has(breadcrumb.category ?? '') ? CHAVES_HTTP : CHAVES_SEGREDO
  return { ...breadcrumb, data: semChaves(breadcrumb.data, removidas) as Breadcrumb['data'] }
}

/** E-mails viram `[email]`; usuário só com `id` (épico #5 §3 item 7, §6). */
export function limparEvento(evento: ErrorEvent): ErrorEvent {
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

/** Sentry só com o `id` do usuário, acompanhando a store de sessão. Devolve o cancelamento. */
export function acompanharUsuario(): () => void {
  const aplicar = ({ status, usuario }: EstadoSessao) => {
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

let spanAbertura: Span | undefined

/** Abertura a frio até a Home com dados (RNF03); com o Sentry desligado não cria span. */
export function iniciarSpanAbertura(): void {
  if (!ambiente.sentryDsn || __DEV__) return
  spanAbertura = Sentry.startInactiveSpan({
    name: 'inicio_home_pronta',
    op: 'app.inicio',
    forceTransaction: true,
  })
}

export function marcarHomePronta(): void {
  spanAbertura?.end()
  spanAbertura = undefined
}

/** Restauração do cache offline (#29), dentro do span de abertura. Devolve o fim do span. */
export function iniciarSpanRestauracao(): () => void {
  if (!spanAbertura) return () => undefined
  const span = Sentry.startInactiveSpan({
    name: 'restaurar_cache',
    op: 'app.cache.restaurar',
    parentSpan: spanAbertura,
  })
  return () => span.end()
}

/** Chamado pela Home: fecha o span de abertura no primeiro render com dados. */
export function useMarcarHomePronta(comDados: boolean): void {
  useEffect(() => {
    if (comDados) marcarHomePronta()
  }, [comDados])
}

/** Sem `EXPO_PUBLIC_SENTRY_DSN` o Sentry fica desligado. */
export function iniciarSentry(): void {
  if (!ambiente.sentryDsn) return
  Sentry.init({
    dsn: ambiente.sentryDsn,
    environment: ambiente.nome,
    ...versaoSentry(),
    enabled: !__DEV__,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    integrations: [integracaoNavegacao],
    beforeBreadcrumb: limparBreadcrumb,
    beforeSend: limparEvento,
  })
  acompanharUsuario()
}
