import { respostaSessaoSchema } from '@atletica/shared'
import { toast } from '@/components/ui/toast'
import { useSessao, type MotivoEncerramento } from '@/infra/sessao/store'
import { ApiErro, CodigoLocal, MENSAGEM_ERRO_GENERICO } from './api-erro'
import { enviar, montarUrl } from './http'

export const ANTECEDENCIA_RENOVACAO_MS = 30_000

export const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
export const MENSAGEM_CONTA_DESATIVADA = 'Sua conta está desativada. Procure a diretoria.'

let renovacaoEmAndamento: Promise<void> | null = null

function sessaoEncerrada(mensagem: string): ApiErro {
  return new ApiErro({ status: 401, code: CodigoLocal.SESSAO_ENCERRADA, message: mensagem })
}

async function encerrar(code: string): Promise<never> {
  const motivo: MotivoEncerramento =
    code === 'CONTA_DESATIVADA' ? 'CONTA_DESATIVADA' : 'SESSAO_EXPIRADA'
  const mensagem =
    motivo === 'CONTA_DESATIVADA' ? MENSAGEM_CONTA_DESATIVADA : MENSAGEM_SESSAO_EXPIRADA
  await useSessao.getState().encerrarSessao({ motivo })
  toast.erro(mensagem)
  throw sessaoEncerrada(mensagem)
}

async function executarRenovacao(): Promise<void> {
  const { refreshToken } = useSessao.getState()
  if (!refreshToken) throw sessaoEncerrada(MENSAGEM_SESSAO_EXPIRADA)

  let resposta: unknown
  try {
    resposta = await enviar(
      montarUrl('/auth/refresh'),
      { metodo: 'POST', corpo: { refreshToken } },
      null,
    )
  } catch (erro) {
    if (erro instanceof ApiErro && erro.status === 401) return encerrar(erro.code)
    throw erro
  }

  const dados = respostaSessaoSchema.safeParse(resposta)
  if (!dados.success) {
    throw new ApiErro({ status: 500, code: 'INTERNAL_ERROR', message: MENSAGEM_ERRO_GENERICO })
  }
  if (useSessao.getState().refreshToken !== refreshToken) return

  const { usuario, ...tokens } = dados.data
  const sessao = useSessao.getState()
  await sessao.atualizarTokens(tokens)
  await sessao.atualizarUsuario(usuario)
}

/**
 * Single-flight: chamadas simultâneas aguardam a mesma promessa (a rotação com detecção de
 * reuso revogaria a sessão). Só `401` do refresh encerra a sessão; rede, timeout e 5xx não.
 */
export function renovarSessao(): Promise<void> {
  renovacaoEmAndamento ??= executarRenovacao().finally(() => {
    renovacaoEmAndamento = null
  })
  return renovacaoEmAndamento
}

export function accessTokenVencendo(agora = Date.now()): boolean {
  const { refreshToken, accessToken, accessTokenExpiraEm } = useSessao.getState()
  if (!refreshToken) return false
  if (!accessToken || !accessTokenExpiraEm) return true
  return Date.parse(accessTokenExpiraEm) - agora < ANTECEDENCIA_RENOVACAO_MS
}
