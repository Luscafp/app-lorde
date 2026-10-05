import type {
  AtleticaAdversaria,
  AtleticaAdversariaAtualizacao,
  AtleticaAdversariaCriacao,
  AtleticasAdversariasQuery,
  ListaAtleticasAdversarias,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { padraoLike, paginarPorSql } from '../../common/busca'
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

const CAMPOS_AUDITADOS = ['nome', 'sigla', 'curso'] as const

function paraDto({ _count, ...atletica }: LinhaAdversaria): AtleticaAdversaria {
  return { ...atletica, totalTimes: _count.times }
}

function auditaveis({ nome, sigla, curso }: LinhaAdversaria) {
  return { nome, sigla, curso }
}

/** `Atletica` com `usaAplicativo = false` (RN21); a que usa o aplicativo responde 404. */
@Injectable()
export class AtleticasAdversariasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar({ q, ...paginacao }: AtleticasAdversariasQuery): Promise<ListaAtleticasAdversarias> {
    const busca = q
      ? Prisma.sql`AND unaccent(lower("nome")) LIKE unaccent(lower(${padraoLike(q)})) ESCAPE '\\'`
      : Prisma.empty
    const origem = Prisma.sql`FROM "Atletica" WHERE "usaAplicativo" = false ${busca}`

    const pagina = await paginarPorSql(this.prisma.db, paginacao, {
      ids: Prisma.sql`SELECT "id" ${origem} ORDER BY unaccent(lower("nome")), "id"`,
      total: Prisma.sql`SELECT count(*) AS "total" ${origem}`,
      buscar: (ids) =>
        this.prisma.db.atletica.findMany({ where: { id: { in: ids } }, select: CAMPOS }),
    })
    return { ...pagina, items: pagina.items.map(paraDto) }
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
      const diff = diferenca(antes, { ...antes, ...entrada }, CAMPOS_AUDITADOS)
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

  /** Sem índice único de nome (épico #16 §8): o lock serializa as escritas contra a corrida. */
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
