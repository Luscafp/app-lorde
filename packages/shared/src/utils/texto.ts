/** `trim` + espaços internos colapsados. */
export function normalizarEspacos(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}
