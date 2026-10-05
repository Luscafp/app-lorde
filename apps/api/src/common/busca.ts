import type { PaginacaoQuery, RespostaPaginada } from '@atletica/shared'
import type { Prisma } from '../generated/prisma/client'
import type { ClienteComEscopo } from '../infra/prisma/prisma.service'

/** `%`, `_` e `\` do termo viram literais no `LIKE`. */
export function padraoLike(termo: string): string {
  return `%${termo.replace(/[\\%_]/g, (caractere) => `\\${caractere}`)}%`
}

/** Reordena as linhas na ordem dos ids (página ordenada em SQL, dados lidos pelo Prisma). */
export function naOrdemDosIds<T extends { id: string }>(ids: string[], linhas: T[]): T[] {
  const porId = new Map(linhas.map((linha) => [linha.id, linha]))
  return ids.flatMap((id) => porId.get(id) ?? [])
}

export interface ConsultaPaginada<T extends { id: string }> {
  /** `SELECT id ... ORDER BY ...`, sem `LIMIT`/`OFFSET`. */
  ids: Prisma.Sql
  /** `SELECT count(*) AS "total" ...`. */
  total: Prisma.Sql
  buscar: (ids: string[]) => Promise<T[]>
}

/** Pagina em SQL (ordem sem acento nem caixa) e lê os dados pelo Prisma (convenções §4.4). */
export async function paginarPorSql<T extends { id: string }>(
  db: ClienteComEscopo,
  { page, limit }: PaginacaoQuery,
  consulta: ConsultaPaginada<T>,
): Promise<RespostaPaginada<T>> {
  const [pagina, [contagem]] = await Promise.all([
    db.$queryRaw<{ id: string }[]>`${consulta.ids} LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    db.$queryRaw<[{ total: bigint }]>`${consulta.total}`,
  ])
  const ids = pagina.map(({ id }) => id)
  const linhas = await consulta.buscar(ids)
  return { items: naOrdemDosIds(ids, linhas), page, limit, total: Number(contagem?.total ?? 0) }
}
