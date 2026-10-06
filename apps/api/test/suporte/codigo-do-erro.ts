import { ErroNegocio } from '../../src/common/erros/erro-negocio'

/** `"<status> <code>"` do `ErroNegocio` lançado por `acao`, ou `undefined` se não lançar. */
export function codigoDoErro(acao: () => unknown): string | undefined {
  try {
    acao()
  } catch (erro) {
    if (erro instanceof ErroNegocio) return `${erro.statusCode} ${erro.code}`
    throw erro
  }
  return undefined
}

/** `code` do erro com que `promessa` rejeita; falha se ela resolver. */
export async function codigoDaRejeicao(promessa: Promise<unknown>): Promise<string> {
  const erro = (await promessa.then(
    () => {
      throw new Error('esperava erro')
    },
    (e: unknown) => e,
  )) as ErroNegocio
  return erro.code
}
