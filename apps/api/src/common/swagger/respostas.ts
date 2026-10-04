export const RESPOSTA_LIMITE_EXCEDIDO = {
  description: '`RATE_LIMITED`: aguarde os segundos do cabeçalho `Retry-After`.',
  headers: { 'Retry-After': { description: 'Segundos até a próxima tentativa.' } },
}
