import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'
import { randomUUID } from 'expo-crypto'
import { ambiente } from '@/config/ambiente'
import {
  ApiErro,
  CodigoApi,
  CodigoLocal,
  MENSAGEM_ERRO_GENERICO,
  type DetalheErro,
} from './api-erro'

export const TEMPO_LIMITE_MS = 15_000

export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ValorConsulta = string | number | boolean | null | undefined

export type OpcoesRequisicao = {
  metodo?: Metodo
  corpo?: unknown
  consulta?: Record<string, ValorConsulta>
  sinal?: AbortSignal
}

type CorpoErro = { code?: unknown; message?: unknown; details?: unknown }

const versaoApp = Constants.expoConfig?.version ?? '0.0.0'

function origem(url: string): string {
  return (/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+/i.exec(url)?.[0] ?? '').toLowerCase()
}

export function montarUrl(caminho: string, consulta?: Record<string, ValorConsulta>): string {
  const base = /^https?:\/\//i.test(caminho)
    ? caminho
    : ambiente.apiUrl.replace(/\/+$/, '') + caminho
  const parametros = Object.entries(consulta ?? {})
    .filter(([, valor]) => valor !== undefined && valor !== null)
    .map(([chave, valor]) => `${encodeURIComponent(chave)}=${encodeURIComponent(String(valor))}`)
  if (parametros.length === 0) return base
  return base + (base.includes('?') ? '&' : '?') + parametros.join('&')
}

/** O token só vai para o domínio de `EXPO_PUBLIC_API_URL` (URLs pré-assinadas vão sem ele). */
export function ehDaApi(url: string): boolean {
  return origem(url) === origem(ambiente.apiUrl)
}

/** Caminho relativo à base da API (`/auth/login`), ou `null` para outro domínio. */
export function caminhoNaApi(url: string): string | null {
  if (!ehDaApi(url)) return null
  const caminho = url.slice(origem(url).length)
  const prefixo = ambiente.apiUrl.slice(origem(ambiente.apiUrl).length).replace(/\/+$/, '')
  return caminho.startsWith(prefixo) ? caminho.slice(prefixo.length) : caminho
}

function lerDetalhes(valor: unknown): DetalheErro[] {
  if (!Array.isArray(valor)) return []
  return valor.filter(
    (item): item is DetalheErro =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as DetalheErro).field === 'string' &&
      typeof (item as DetalheErro).message === 'string',
  )
}

function erroDaResposta(status: number, corpo: CorpoErro | null, requestId: string): ApiErro {
  return new ApiErro({
    status,
    code:
      typeof corpo?.code === 'string'
        ? corpo.code
        : status >= 500
          ? CodigoApi.INTERNAL_ERROR
          : CodigoLocal.ERRO_HTTP,
    message: typeof corpo?.message === 'string' ? corpo.message : MENSAGEM_ERRO_GENERICO,
    details: lerDetalhes(corpo?.details),
    requestId,
  })
}

/** Correlação app ↔ API: só `requestId`, método, rota (sem query) e status. */
function registrarErroServidor(url: string, metodo: Metodo, status: number, requestId: string) {
  const caminho = caminhoNaApi(url)
  if (caminho === null) return
  const rota = caminho.replace(/[?#].*$/, '')
  Sentry.addBreadcrumb({
    category: 'http',
    type: 'http',
    level: 'error',
    message: `${metodo} ${rota} ${status}`,
    data: { requestId, metodo, rota, status },
  })
}

async function lerJson(resposta: Response): Promise<unknown> {
  const texto = await resposta.text()
  if (!texto) return undefined
  try {
    return JSON.parse(texto) as unknown
  } catch {
    return undefined
  }
}

/** Uma requisição, sem renovação de sessão. Qualquer falha vira `ApiErro`. */
export async function enviar<T>(
  url: string,
  { metodo = 'GET', corpo, sinal }: OpcoesRequisicao,
  accessToken: string | null,
): Promise<T> {
  const requestId = randomUUID()
  const cabecalhos: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-Id': requestId,
    'X-App-Version': versaoApp,
  }
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json'
  if (accessToken && ehDaApi(url)) cabecalhos.Authorization = `Bearer ${accessToken}`

  const controle = new AbortController()
  let estourou = false
  const limite = setTimeout(() => {
    estourou = true
    controle.abort()
  }, TEMPO_LIMITE_MS)
  const cancelar = () => controle.abort()
  if (sinal?.aborted) controle.abort()
  sinal?.addEventListener('abort', cancelar)

  try {
    const resposta = await fetch(url, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: controle.signal,
    })
    const dados = await lerJson(resposta)
    if (!resposta.ok) {
      const idResposta = resposta.headers.get('x-request-id') ?? requestId
      if (resposta.status >= 500) registrarErroServidor(url, metodo, resposta.status, idResposta)
      throw erroDaResposta(resposta.status, dados as CorpoErro | null, idResposta)
    }
    return dados as T
  } catch (erro) {
    if (erro instanceof ApiErro) throw erro
    if (estourou) {
      throw new ApiErro({
        status: 0,
        code: CodigoLocal.TEMPO_ESGOTADO,
        message: 'O servidor demorou para responder. Tente novamente.',
        requestId,
      })
    }
    if (sinal?.aborted) throw erro
    throw new ApiErro({
      status: 0,
      code: CodigoLocal.SEM_CONEXAO,
      message: 'Sem conexão. Verifique sua internet e tente novamente.',
      requestId,
    })
  } finally {
    clearTimeout(limite)
    sinal?.removeEventListener('abort', cancelar)
  }
}
