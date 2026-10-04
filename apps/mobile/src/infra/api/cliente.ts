import { useSessao } from '@/infra/sessao/store'
import { ApiErro, CodigoLocal } from './api-erro'
import { ehDaApi, enviar, montarUrl, type OpcoesRequisicao } from './http'
import { accessTokenVencendo, renovarSessao } from './renovar-sessao'

export { ApiErro, CodigoLocal, type DetalheErro } from './api-erro'
export type { OpcoesRequisicao } from './http'

type Registrador = (mensagem: string, contexto: Record<string, unknown>) => void

let registrar: Registrador = (mensagem, contexto) => console.warn(mensagem, contexto)

/** A #49 troca o registrador padrão (console) pelo Sentry. */
export function definirRegistrador(registrador: Registrador): void {
  registrar = registrador
}

function ehRotaDeAuth(caminho: string): boolean {
  return /^\/auth(\/|$)/.test(caminho)
}

async function renovarAntesDeEnviar(): Promise<void> {
  if (!accessTokenVencendo()) return
  try {
    await renovarSessao()
  } catch (erro) {
    if (erro instanceof ApiErro && erro.code === CodigoLocal.SESSAO_ENCERRADA) throw erro
  }
}

/**
 * `caminho` relativo à API (`/eventos`) ou URL absoluta. Fora de `/auth/*`, um `401` dispara
 * `renovarSessao()` e a requisição é refeita uma única vez.
 */
export async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const url = montarUrl(caminho, opcoes.consulta)
  const podeRenovar = ehDaApi(url) && !ehRotaDeAuth(caminho)

  if (podeRenovar) await renovarAntesDeEnviar()
  const tokenUsado = useSessao.getState().accessToken

  try {
    return await enviar<T>(url, opcoes, tokenUsado)
  } catch (erro) {
    const ehNaoAutenticado = erro instanceof ApiErro && erro.status === 401
    if (!ehNaoAutenticado || !podeRenovar || !useSessao.getState().refreshToken) throw erro
  }

  if (useSessao.getState().accessToken === tokenUsado) await renovarSessao()

  try {
    return await enviar<T>(url, opcoes, useSessao.getState().accessToken)
  } catch (erro) {
    if (erro instanceof ApiErro && erro.status === 401) {
      registrar('401 depois da renovação da sessão', {
        caminho,
        code: erro.code,
        requestId: erro.requestId,
      })
    }
    throw erro
  }
}

type OpcoesSemMetodo = Omit<OpcoesRequisicao, 'metodo' | 'corpo'>

export const api = {
  get: <T>(caminho: string, opcoes?: OpcoesSemMetodo) => requisitar<T>(caminho, opcoes),
  post: <T>(caminho: string, corpo?: unknown, opcoes?: OpcoesSemMetodo) =>
    requisitar<T>(caminho, { ...opcoes, metodo: 'POST', corpo }),
  put: <T>(caminho: string, corpo?: unknown, opcoes?: OpcoesSemMetodo) =>
    requisitar<T>(caminho, { ...opcoes, metodo: 'PUT', corpo }),
  patch: <T>(caminho: string, corpo?: unknown, opcoes?: OpcoesSemMetodo) =>
    requisitar<T>(caminho, { ...opcoes, metodo: 'PATCH', corpo }),
  delete: <T>(caminho: string, opcoes?: OpcoesSemMetodo) =>
    requisitar<T>(caminho, { ...opcoes, metodo: 'DELETE' }),
}
