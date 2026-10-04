import { respostaSessaoSchema } from '@atletica/shared'
import { toast } from '@/components/ui/toast'
import { useSessao, type MotivoEncerramento } from '@/infra/sessao/store'
import {
  ApiErro,
  CodigoApi,
  CodigoLocal,
  ehNaoAutenticado,
  MENSAGEM_ERRO_GENERICO,
} from './api-erro'
import { enviar, montarUrl } from './http'

export const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
export const MENSAGEM_CONTA_DESATIVADA = 'Sua conta está desativada. Procure a diretoria.'

type MotivoDoRefresh = Extract<MotivoEncerramento, 'CONTA_DESATIVADA' | 'SESSAO_EXPIRADA'>

const MENSAGEM_POR_MOTIVO: Record<MotivoDoRefresh, string> = {
  CONTA_DESATIVADA: MENSAGEM_CONTA_DESATIVADA,
  SESSAO_EXPIRADA: MENSAGEM_SESSAO_EXPIRADA,
}

let renovacaoEmAndamento: Promise<void> | null = null

function sessaoEncerrada(mensagem: string): ApiErro {
  return new ApiErro({ status: 401, code: CodigoLocal.SESSAO_ENCERRADA, message: mensagem })
}

async function encerrar(code: string): Promise<never> {
  const motivo: MotivoDoRefresh =
    code === CodigoApi.CONTA_DESATIVADA ? 'CONTA_DESATIVADA' : 'SESSAO_EXPIRADA'
  const mensagem = MENSAGEM_POR_MOTIVO[motivo]
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
    if (ehNaoAutenticado(erro)) return encerrar(erro.code)
    throw erro
  }

  const dados = respostaSessaoSchema.safeParse(resposta)
  if (!dados.success) {
    throw new ApiErro({
      status: 500,
      code: CodigoApi.INTERNAL_ERROR,
      message: MENSAGEM_ERRO_GENERICO,
    })
  }
  if (useSessao.getState().refreshToken !== refreshToken) return

  const { usuario, ...tokens } = dados.data
  const sessao = useSessao.getState()
  await sessao.atualizarTokens(tokens)
  await sessao.atualizarUsuario(usuario)
}

/** Single-flight: a rotação com detecção de reuso revogaria a sessão num refresh paralelo. */
export function renovarSessao(): Promise<void> {
  renovacaoEmAndamento ??= executarRenovacao().finally(() => {
    renovacaoEmAndamento = null
  })
  return renovacaoEmAndamento
}
