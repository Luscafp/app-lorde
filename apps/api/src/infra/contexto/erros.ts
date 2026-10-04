/** Modelo com escopo consultado sem atlética no contexto (falha fechada, RNF20): vira 500. */
export class ErroAtleticaContextoAusente extends Error {
  override readonly name = 'ErroAtleticaContextoAusente'

  constructor(
    readonly modelo: string,
    readonly operacao: string,
  ) {
    super(`Consulta a ${modelo}.${operacao} sem atlética no contexto da requisição.`)
  }
}

/** Escrita com atlética diferente da do contexto. Bug de programação: vira 500. */
export class ErroAtleticaDivergente extends Error {
  override readonly name = 'ErroAtleticaDivergente'

  constructor(
    readonly modelo: string,
    readonly operacao: string,
  ) {
    super(`${modelo}.${operacao} com atleticaId diferente da atlética do contexto.`)
  }
}
