import {
  normalizarNomeTag,
  Papel,
  StatusNoticia,
  temNivelMinimo,
  type ListaTags,
  type TagsQuery,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { padraoLike } from '../../common/busca'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../infra/prisma/prisma.service'
import type { UsuarioAutenticado } from '../auth/tipos'

type Solicitante = Pick<UsuarioAutenticado, 'atleticaId' | 'papel'>

/** `$queryRaw` não passa pela extensão multi-atlética: o filtro de atlética vai no SQL. */
function consultaTags(atleticaId: string, { q }: TagsQuery, emUso: boolean): Prisma.Sql {
  const busca = q
    ? Prisma.sql`AND t."nomeNormalizado" LIKE ${padraoLike(normalizarNomeTag(q))} ESCAPE '\\'`
    : Prisma.empty
  return Prisma.sql`
    SELECT t."id", t."nome", t."nomeNormalizado", count(n."id")::int AS "totalNoticias"
    FROM "Tag" t
    LEFT JOIN "NoticiaTag" nt ON nt."tagId" = t."id"
    LEFT JOIN "Noticia" n ON n."id" = nt."noticiaId"
      AND n."status" = ${StatusNoticia.PUBLICADA}::"StatusNoticia"
      AND n."excluidoEm" IS NULL
    WHERE t."atleticaId" = ${atleticaId}::uuid ${busca}
    GROUP BY t."id"
    ${emUso ? Prisma.sql`HAVING count(n."id") > 0` : Prisma.empty}`
}

/** Tags da atlética; o Atleta só vê as usadas em notícias publicadas (RN24). */
@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async listar({ atleticaId, papel }: Solicitante, query: TagsQuery): Promise<ListaTags> {
    const { page, limit } = query
    const emUso = query.emUso || !temNivelMinimo(papel, Papel.DIRETOR)
    const tags = consultaTags(atleticaId, query, emUso)
    const [items, [contagem]] = await Promise.all([
      this.prisma.db.$queryRaw<{ id: string; nome: string; totalNoticias: number }[]>`
        SELECT "id", "nome", "totalNoticias" FROM (${tags}) t
        ORDER BY "nomeNormalizado", "id"
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      this.prisma.db.$queryRaw<[{ total: bigint }]>`SELECT count(*) AS "total" FROM (${tags}) t`,
    ])
    return { items, page, limit, total: Number(contagem?.total ?? 0) }
  }
}
