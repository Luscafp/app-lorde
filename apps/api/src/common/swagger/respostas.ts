export const RESPOSTA_LIMITE_EXCEDIDO = {
  description: '`RATE_LIMITED`: aguarde os segundos do cabeçalho `Retry-After`.',
  headers: { 'Retry-After': { description: 'Segundos até a próxima tentativa.' } },
}

type LinhaErro = readonly [status: number, code: string, quando: string]

/** Tabela Markdown `HTTP | code | Quando` para a descrição da operação. */
export function tabelaErros(linhas: readonly LinhaErro[]): string {
  const corpo = linhas.map(([status, code, quando]) => `| ${status} | \`${code}\` | ${quando} |`)
  return ['| HTTP | code | Quando |', '|---|---|---|', ...corpo].join('\n')
}
