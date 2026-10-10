/** Aborta a operação via `AbortSignal` quando o prazo acaba. */
export async function comTempoLimite<T>(
  ms: number,
  operacao: (sinal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controle = new AbortController()
  const limite = setTimeout(() => controle.abort(), ms)
  try {
    return await operacao(controle.signal)
  } finally {
    clearTimeout(limite)
  }
}
