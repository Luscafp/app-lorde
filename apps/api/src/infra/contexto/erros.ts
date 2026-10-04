/**
 * Consulta a um modelo com escopo sem atlética no contexto (falha fechada, RNF20). Indica bug de
 * programação (rota sem guard, job sem `executarComAtletica`): o filtro global responde
 * `500 INTERNAL_ERROR` e o erro vai ao Sentry.
 */
export class AtleticaContextoAusenteError extends Error {
  override readonly name = 'AtleticaContextoAusenteError'

  constructor(
    readonly modelo: string,
    readonly operacao: string,
  ) {
    super(`Consulta a ${modelo}.${operacao} sem atlética no contexto da requisição.`)
  }
}

/**
 * Escrita em um modelo com escopo com `atleticaId` diferente da atlética do contexto. Bug de
 * programação: o filtro global responde `500 INTERNAL_ERROR`.
 */
export class ErroAtleticaDivergente extends Error {
  override readonly name = 'ErroAtleticaDivergente'

  constructor(
    readonly modelo: string,
    readonly operacao: string,
  ) {
    super(`${modelo}.${operacao} com atleticaId diferente da atlética do contexto.`)
  }
}
