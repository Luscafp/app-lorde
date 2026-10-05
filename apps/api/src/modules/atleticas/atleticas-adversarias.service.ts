import type {
  AtleticaAdversaria,
  AtleticaAdversariaAtualizacao,
  AtleticaAdversariaCriacao,
  AtleticasAdversariasQuery,
  ListaAtleticasAdversarias,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { naOrdemDosIds, padraoLike } from '../../common/busca'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService } from '../auditoria/auditoria.service'
import { diferenca } from '../auditoria/diferenca'
import { erroAdversariaDuplicada, erroAdversariaNaoEncontrada } from './erros'

const CAMPOS = {
  id: true,
  nome: true,
  sigla: true,
  curso: true,
  _count: { select: { times: true } },
} as const satisfies Prisma.AtleticaSelect

type LinhaAdversaria = Prisma.AtleticaGetPayload<{ select: typeof CAMPOS }>

const ADVERSARIA = { usaAplicativo: false } as const

function paraDto({ _count, ...atletica }: LinhaAdversaria): AtleticaAdversaria {
  return { ...atletica, totalTimes: _count.times }
}

function auditaveis({ nome, sigla, curso }: LinhaAdversaria) {
  return { nome, sigla, curso }
}

/**
 * Atléticas adversárias: `Atletica` com `usaAplicativo = false` (RN21). A atlética que usa o
 * aplicativo nunca é lida nem alterada aqui (404).
 */
@Injectable()
export class AtleticasAdversariasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Página ordenada em SQL (sem acento nem caixa); os dados vêm do Prisma. */
  async listar({ q, page, limit }: AtleticasAdversariasQuery): Promise<ListaAtleticasAdversarias> {
    const filtros = q
      ? Prisma.sql`"usaAplicativo" = false
          AND unaccent(lower("nome")) LIKE unaccent(lower(${padraoLike(q)})) ESCAPE '\\'`
      : Prisma.sql`"usaAplicativo" = false`

    const [pagina, [contagem]] = await Promise.all([
      this.prisma.db.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Atletica" WHERE ${filtros}
        ORDER BY unaccent(lower("nome")), "id"
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      this.prisma.db.$queryRaw<[{ total: bigint }]>`
        SELECT count(*) AS "total" FROM "Atletica" WHERE ${filtros}`,
    ])
    const ids = pagina.map(({ id }) => id)
    const atleticas = await this.prisma.db.atletica.findMany({
      where: { id: { in: ids } },
      select: CAMPOS,
    })

    return {
      items: naOrdemDosIds(ids, atleticas).map(paraDto),
      page,
      limit,
      total: Number(contagem?.total ?? 0),
    }
  }

  criar(entrada: AtleticaAdversariaCriacao): Promise<AtleticaAdversaria> {
    return this.gravar(async (tx) => {
      await this.garantirNomeLivre(tx, entrada.nome)
      const criada = await tx.atletica.create({
        data: { ...entrada, ...ADVERSARIA },
        select: CAMPOS,
      })
      await this.auditoria.registrar(tx, {
        entidade: 'Atletica',
        acao: 'ATLETICA_ADVERSARIA_CRIADA',
        entidadeId: criada.id,
        dados: { antes: null, depois: auditaveis(criada) },
      })
      return paraDto(criada)
    })
  }

  /** Sem mudança: devolve a atlética sem gravar nem auditar (convenções §7). */
  atualizar(id: string, entrada: AtleticaAdversariaAtualizacao): Promise<AtleticaAdversaria> {
    return this.gravar(async (tx) => {
      const antes = await this.buscar(tx, id)
      const diff = diferenca(antes, { ...antes, ...entrada }, ['nome', 'sigla', 'curso'])
      if (!diff) return paraDto(antes)

      if (entrada.nome !== undefined && 'nome' in diff.depois) {
        await this.garantirNomeLivre(tx, entrada.nome, id)
      }
      const depois = await tx.atletica.update({ where: { id }, data: entrada, select: CAMPOS })
      await this.auditoria.registrar(tx, {
        entidade: 'Atletica',
        acao: 'ATLETICA_ADVERSARIA_ALTERADA',
        entidadeId: id,
        dados: diff,
      })
      return paraDto(depois)
    })
  }

  /**
   * Sem índice único para o nome de adversária (épico #16 §8): o lock serializa as escritas para
   * que a checagem dentro da transação valha também na corrida.
   */
  private gravar<T>(fn: (tx: TransacaoComEscopo) => Promise<T>): Promise<T> {
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('atleticas-adversarias'))`
      return fn(tx)
    })
  }

  private async buscar(tx: TransacaoComEscopo, id: string): Promise<LinhaAdversaria> {
    const atletica = await tx.atletica.findFirst({ where: { id, ...ADVERSARIA }, select: CAMPOS })
    if (!atletica) throw erroAdversariaNaoEncontrada()
    return atletica
  }

  private async garantirNomeLivre(
    tx: TransacaoComEscopo,
    nome: string,
    ignorarId: string | null = null,
  ): Promise<void> {
    const [existente] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Atletica"
      WHERE "usaAplicativo" = false AND lower("nome") = lower(${nome})
        AND (${ignorarId}::uuid IS NULL OR "id" <> ${ignorarId}::uuid)
      LIMIT 1`
    if (existente) throw erroAdversariaDuplicada()
  }
}
