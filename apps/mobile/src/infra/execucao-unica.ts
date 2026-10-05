/** Single-flight: chamadas feitas enquanto uma execução está em andamento recebem a mesma promessa. */
export function execucaoUnica<T>(executar: () => Promise<T>): () => Promise<T> {
  let emAndamento: Promise<T> | null = null
  return () => {
    emAndamento ??= executar().finally(() => {
      emAndamento = null
    })
    return emAndamento
  }
}
