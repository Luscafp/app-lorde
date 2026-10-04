import * as Sentry from '@sentry/nestjs'
import type { Request } from 'express'
import type { Env } from '../../config/env.schema'
import { versaoApi, type EnvCommit } from '../../config/versao'
import { contextoDaRequisicao } from '../contexto/contexto-requisicao'
import { rotaDaRequisicao } from '../logs/rota'

const REGEX_EMAIL = /[^@\s]+@[^@\s]+/g
const CABECALHOS_REMOVIDOS = new Set(['authorization', 'cookie'])

/**
 * Equivalente ao `sendDefaultPii: false` (removido no SDK 11): o padrão do `dataCollection` coleta
 * tudo, inclusive corpos e variáveis locais dos frames (onde pode haver senha).
 */
export const COLETA_MINIMA: Sentry.NodeOptions['dataCollection'] = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { deny: [...CABECALHOS_REMOVIDOS] }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
}

function ocultarEmails(valor: unknown): unknown {
  if (typeof valor === 'string') return valor.replace(REGEX_EMAIL, '[email]')
  if (Array.isArray(valor)) return valor.map(ocultarEmails)
  if (typeof valor === 'object' && valor !== null) {
    return Object.fromEntries(Object.entries(valor).map(([chave, v]) => [chave, ocultarEmails(v)]))
  }
  return valor
}

/** Scrubbing de PII (épico #5 §3 item 5): sem corpo, cookies, `Authorization` nem e-mail. */
export function beforeSend(evento: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (evento.request) {
    const { data: _data, cookies: _cookies, headers, ...request } = evento.request
    evento.request = {
      ...request,
      ...(headers && {
        headers: Object.fromEntries(
          Object.entries(headers).filter(([nome]) => !CABECALHOS_REMOVIDOS.has(nome.toLowerCase())),
        ),
      }),
    }
  }
  if (evento.message) evento.message = ocultarEmails(evento.message) as string
  if (evento.extra) evento.extra = ocultarEmails(evento.extra) as Record<string, unknown>
  for (const excecao of evento.exception?.values ?? []) {
    if (excecao.value) excecao.value = ocultarEmails(excecao.value) as string
  }
  if (evento.user) evento.user = evento.user.id === undefined ? undefined : { id: evento.user.id }
  return evento
}

/** Opções do `Sentry.init`; `undefined` sem `SENTRY_DSN` (Sentry desligado). */
export function opcoesSentry(
  env: Pick<Env, 'APP_ENV' | 'SENTRY_DSN' | 'SENTRY_TRACES_SAMPLE_RATE'> & EnvCommit,
): Sentry.NodeOptions | undefined {
  if (!env.SENTRY_DSN) return undefined
  return {
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    release: `api@${versaoApi(env)}`,
    dataCollection: COLETA_MINIMA,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    beforeSend,
  }
}

/** Erro 5xx de uma requisição (filtro global): usuário só com `id`. */
export function capturarErroHttp(erro: unknown, req: Request): void {
  const contexto = contextoDaRequisicao(req)
  Sentry.captureException(erro, {
    user: contexto?.usuarioId ? { id: contexto.usuarioId } : undefined,
    tags: {
      requestId: contexto?.requestId,
      route: rotaDaRequisicao(req),
      atleticaId: contexto?.atleticaId,
    },
  })
}

/** Erro em job (`@nestjs/schedule` #58, pg-boss #86), com a tag `job=<nome>`. Sem dado pessoal em `contexto`. */
export function capturarErroJob(
  nome: string,
  erro: unknown,
  contexto: Record<string, unknown> = {},
): void {
  Sentry.captureException(erro, { tags: { job: nome }, extra: contexto })
}
