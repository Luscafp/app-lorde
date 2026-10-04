export type DetalheErro = { field: string; message: string }

/** Códigos criados no app; os demais vêm da API (convenções §4.2). */
export const CodigoLocal = {
  SEM_CONEXAO: 'SEM_CONEXAO',
  TEMPO_ESGOTADO: 'TEMPO_ESGOTADO',
  SESSAO_ENCERRADA: 'SESSAO_ENCERRADA',
  ERRO_HTTP: 'ERRO_HTTP',
} as const

export const CodigoApi = {
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONTA_DESATIVADA: 'CONTA_DESATIVADA',
  CREDENCIAIS_INVALIDAS: 'CREDENCIAIS_INVALIDAS',
  EMAIL_JA_CADASTRADO: 'EMAIL_JA_CADASTRADO',
  RATE_LIMITED: 'RATE_LIMITED',
} as const

export const MENSAGEM_ERRO_GENERICO = 'Ocorreu um erro inesperado. Tente novamente.'

type DadosApiErro = {
  status: number
  code: string
  message: string
  details?: DetalheErro[]
  requestId?: string | null
  segundosParaNovaTentativa?: number | null
}

/** Formato único de erro do app; `status` é 0 quando a resposta não chegou. */
export class ApiErro extends Error {
  readonly status: number
  readonly code: string
  readonly details: DetalheErro[]
  readonly requestId: string | null
  /** Cabeçalho `Retry-After` do `429`. */
  readonly segundosParaNovaTentativa: number | null

  constructor({
    status,
    code,
    message,
    details = [],
    requestId = null,
    segundosParaNovaTentativa = null,
  }: DadosApiErro) {
    super(message)
    this.name = 'ApiErro'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
    this.segundosParaNovaTentativa = segundosParaNovaTentativa
  }
}

export function ehErroTransitorio(erro: unknown): boolean {
  return (
    erro instanceof ApiErro &&
    (erro.code === CodigoLocal.SEM_CONEXAO ||
      erro.code === CodigoLocal.TEMPO_ESGOTADO ||
      erro.status >= 500)
  )
}

export function ehNaoAutenticado(erro: unknown): erro is ApiErro {
  return erro instanceof ApiErro && erro.status === 401
}

export function ehSessaoEncerrada(erro: unknown): erro is ApiErro {
  return erro instanceof ApiErro && erro.code === CodigoLocal.SESSAO_ENCERRADA
}
