import * as Sentry from '@sentry/react-native'
import { accessTokenVencendo, useSessao } from '@/infra/sessao/store'
import { ehNaoAutenticado, ehSessaoEncerrada } from './api-erro'
import { caminhoNaApi, enviar, montarUrl, type OpcoesRequisicao } from './http'
import { renovarSessao } from './renovar-sessao'

export { ApiErro, CodigoLocal, type DetalheErro } from './api-erro'
export type { OpcoesRequisicao } from './http'

function avisar(mensagem: string, contexto: Record<string, unknown>): void {
  if (__DEV__) console.warn(mensagem, contexto)
  Sentry.captureMessage(mensagem, { level: 'warning', extra: contexto })
}

function podeRenovarSessao(url: string): boolean {
  const caminho = caminhoNaApi(url)
  return caminho !== null && !/^\/auth(?:[/?#]|$)/.test(caminho)
}

async function renovarAntesDeEnviar(): Promise<void> {
  if (!accessTokenVencendo()) return
  try {
    await renovarSessao()
  } catch (erro) {
    if (ehSessaoEncerrada(erro)) throw erro
  }
}

/** `caminho` relativo à API (`/eventos`) ou URL absoluta. */
export async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const url = montarUrl(caminho, opcoes.consulta)
  const podeRenovar = podeRenovarSessao(url)

  if (podeRenovar) await renovarAntesDeEnviar()
  const tokenUsado = useSessao.getState().accessToken

  try {
    return await enviar<T>(url, opcoes, tokenUsado)
  } catch (erro) {
    if (!ehNaoAutenticado(erro) || !podeRenovar || !useSessao.getState().refreshToken) throw erro
  }

  if (useSessao.getState().accessToken === tokenUsado) await renovarSessao()

  try {
    return await enviar<T>(url, opcoes, useSessao.getState().accessToken)
  } catch (erro) {
    if (ehNaoAutenticado(erro)) {
      avisar('401 depois da renovação da sessão', {
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
  delete: <T>(caminho: string, opcoes?: Omit<OpcoesRequisicao, 'metodo'>) =>
    requisitar<T>(caminho, { ...opcoes, metodo: 'DELETE' }),
}
