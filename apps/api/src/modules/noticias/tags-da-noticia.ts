import { normalizarNomeTag, type TagResumoDto } from '@atletica/shared'
import type { Prisma } from '../../generated/prisma/client'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'

export const CAMPOS_TAGS = {
  select: { tag: { select: { id: true, nome: true } } },
  orderBy: { tag: { nomeNormalizado: 'asc' } },
} as const satisfies Prisma.Noticia$tagsArgs

export function paraTags(tags: { tag: TagResumoDto }[]): TagResumoDto[] {
  return tags.map(({ tag }) => tag)
}

export function idsDasTags(tags: { tag: TagResumoDto }[]): string[] {
  return tags.map(({ tag }) => tag.id).sort()
}

/**
 * Cria as que faltam na atlética e devolve os ids, ordenados.
 * `ON CONFLICT DO NOTHING` (skipDuplicates) torna a criação concorrente segura.
 */
export async function garantirTags(
  tx: TransacaoComEscopo,
  atleticaId: string,
  nomes: string[],
): Promise<string[]> {
  if (nomes.length === 0) return []
  const data = nomes.map((nome) => ({
    atleticaId,
    nome,
    nomeNormalizado: normalizarNomeTag(nome),
  }))
  await tx.tag.createMany({ data, skipDuplicates: true })
  const tags = await tx.tag.findMany({
    where: { nomeNormalizado: { in: data.map(({ nomeNormalizado }) => nomeNormalizado) } },
    select: { id: true },
  })
  return tags.map(({ id }) => id).sort()
}

export async function substituirTags(
  tx: TransacaoComEscopo,
  noticiaId: string,
  tagIds: string[],
): Promise<void> {
  await tx.noticiaTag.deleteMany({ where: { noticiaId } })
  if (tagIds.length > 0) {
    await tx.noticiaTag.createMany({ data: tagIds.map((tagId) => ({ noticiaId, tagId })) })
  }
}
