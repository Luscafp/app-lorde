export interface DetalheErro {
  field: string
  message: string
}

/** Formato único de erro da API (convenções §4.1). */
export interface RespostaErro {
  statusCode: number
  code: string
  message: string
  details: DetalheErro[]
}

/** Exceção de negócio com `code` estável, lançada pelos services (ex.: 409, 422). */
export class ErroNegocio extends Error {
  override readonly name = 'ErroNegocio'

  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details: DetalheErro[] = [],
  ) {
    super(message)
  }
}

/** `429 RATE_LIMITED`; o filtro global devolve o cabeçalho `Retry-After` (convenções §4.1). */
export class ErroLimiteExcedido extends ErroNegocio {
  constructor(
    readonly segundosParaNovaTentativa: number,
    message = 'Muitas tentativas. Tente novamente mais tarde.',
  ) {
    super(429, 'RATE_LIMITED', message)
  }
}
