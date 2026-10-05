/** `%`, `_` e `\` do termo viram literais no `LIKE`. */
export function padraoLike(termo: string): string {
  return `%${termo.replace(/[\\%_]/g, (caractere) => `\\${caractere}`)}%`
}

/** Reordena as linhas na ordem dos ids (página ordenada em SQL, dados lidos pelo Prisma). */
export function naOrdemDosIds<T extends { id: string }>(ids: string[], linhas: T[]): T[] {
  const porId = new Map(linhas.map((linha) => [linha.id, linha]))
  return ids.flatMap((id) => porId.get(id) ?? [])
}
