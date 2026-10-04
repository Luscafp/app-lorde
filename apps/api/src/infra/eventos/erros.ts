/** `aposCommit` fora de `TransacaoService.executar`. Bug de programação: vira 500. */
export class ErroForaDeTransacao extends Error {
  override readonly name = 'ErroForaDeTransacao'

  constructor() {
    super('aposCommit chamado fora de TransacaoService.executar.')
  }
}
