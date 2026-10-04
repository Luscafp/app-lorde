let atual = 0

/**
 * Número crescente para valores únicos nas fábricas (e-mail, slug, nome). Não é zerado pelo
 * `limparBanco`: valores nunca se repetem dentro de um arquivo de teste.
 */
export function proximaSequencia(): number {
  atual += 1
  return atual
}
