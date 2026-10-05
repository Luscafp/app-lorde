import {
  EscopoTimes,
  type ListaTimes,
  type TimeAtualizacao,
  type TimeCriacao,
  type TimeDto,
  type TimesQuery,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { padraoLike, paginarPorSql } from '../../common/busca'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { erroAdversariaNaoEncontrada } from '../atleticas/erros'
import { AuditoriaService } from '../auditoria/auditoria.service'
import { diferenca } from '../auditoria/diferenca'
import { entradasDaAlteracao } from '../auditoria/entradas-da-alteracao'
import { erroModalidadeNaoEncontrada } from '../modalidades/erros'
import {
  erroModalidadeInativa,
  erroTimeComDependencias,
  erroTimeComEventos,
  erroTimeDuplicado,
  erroTimeNaoEncontrado,
} from './erros'
import { CAMPOS_TIME as CAMPOS, paraDto, VISIVEL_PARA_TODOS, type LinhaTime } from './linha-time'

const CAMPOS_AUDITADOS = ['nome', 'modalidadeId', 'ativo'] as const

const ACOES_DA_ALTERACAO = {
  alteracao: 'TIME_ALTERADO',
  ativacao: 'TIME_ATIVADO',
  desativacao: 'TIME_DESATIVADO',
} as const

function eventosDoTime(id: string): Prisma.EventoWhereInput {
  return { OR: [{ timeId: id }, { timeAdversarioId: id }] }
}

function auditaveis({ nome, modalidadeId, atleticaId, ativo }: LinhaTime) {
  return { nome, modalidadeId, atleticaId, ativo }
}

/** `$queryRaw` não passa pela extensão multi-atlética: `escopo` aplica o filtro de `Time` no SQL. */
function filtrosDaLista(atleticaId: string, query: TimesQuery): Prisma.Sql {
  const condicoes = [
    query.escopo === EscopoTimes.PROPRIOS
      ? Prisma.sql`t."atleticaId" = ${atleticaId}::uuid`
      : Prisma.sql`a."usaAplicativo" = false`,
  ]
  if (query.modalidadeId) {
    condicoes.push(Prisma.sql`t."modalidadeId" = ${query.modalidadeId}::uuid`)
  }
  if (query.atleticaId) condicoes.push(Prisma.sql`t."atleticaId" = ${query.atleticaId}::uuid`)
  if (!query.incluirInativos) condicoes.push(Prisma.sql`t."ativo" AND m."ativa"`)
  if (query.q) {
    condicoes.push(
      Prisma.sql`unaccent(lower(t."nome")) LIKE unaccent(lower(${padraoLike(query.q)})) ESCAPE '\\'`,
    )
  }
  return Prisma.join(condicoes, ' AND ')
}

/** Times da atlética ativa e de adversárias (épico #16; escopo de `Time`, convenções §6). */
@Injectable()
export class TimesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** `incluirInativos` já vem resolvido pelo papel (só a Diretoria). */
  async listar(atleticaId: string, query: TimesQuery): Promise<ListaTimes> {
    const origem = Prisma.sql`FROM "Time" t
      JOIN "Atletica" a ON a."id" = t."atleticaId"
      JOIN "Modalidade" m ON m."id" = t."modalidadeId"
      WHERE ${filtrosDaLista(atleticaId, query)}`

    const pagina = await paginarPorSql(this.prisma.db, query, {
      ids: Prisma.sql`SELECT t."id" ${origem}
        ORDER BY unaccent(lower(m."nome")), unaccent(lower(t."nome")), t."id"`,
      total: Prisma.sql`SELECT count(*) AS "total" ${origem}`,
      buscar: (ids) => this.prisma.db.time.findMany({ where: { id: { in: ids } }, select: CAMPOS }),
    })
    return { ...pagina, items: pagina.items.map((time) => paraDto(time, atleticaId)) }
  }

  async detalhar(id: string, atleticaId: string, incluirInativos: boolean): Promise<TimeDto> {
    const time = await this.prisma.db.time.findFirst({
      where: incluirInativos ? { id } : { id, ...VISIVEL_PARA_TODOS },
      select: CAMPOS,
    })
    if (!time) throw erroTimeNaoEncontrado()
    return paraDto(time, atleticaId)
  }

  /** O `atleticaId` de `Time` não vem da extensão: é a atlética ativa ou a adversária. */
  criar(atleticaId: string, entrada: TimeCriacao): Promise<TimeDto> {
    return this.gravar(async (tx) => {
      const dona = entrada.atleticaAdversariaId
        ? await this.buscarAdversaria(tx, entrada.atleticaAdversariaId)
        : atleticaId
      await this.validarModalidade(tx, entrada.modalidadeId)

      const criado = await tx.time.create({
        data: { nome: entrada.nome, modalidadeId: entrada.modalidadeId, atleticaId: dona },
        select: CAMPOS,
      })
      await this.auditoria.registrar(tx, {
        entidade: 'Time',
        acao: 'TIME_CRIADO',
        entidadeId: criado.id,
        dados: { antes: null, depois: auditaveis(criado) },
      })
      return paraDto(criado, atleticaId)
    })
  }

  /** Sem mudança: devolve o time sem gravar nem auditar (convenções §7). */
  atualizar(id: string, atleticaId: string, entrada: TimeAtualizacao): Promise<TimeDto> {
    return this.gravar(async (tx) => {
      const antes = await this.buscar(tx, id)
      const diff = diferenca(antes, { ...antes, ...entrada }, CAMPOS_AUDITADOS)
      if (!diff) return paraDto(antes, atleticaId)

      if (entrada.modalidadeId !== undefined && 'modalidadeId' in diff.depois) {
        await this.validarModalidade(tx, entrada.modalidadeId)
        await this.garantirSemEventos(tx, id)
      }
      const depois = await tx.time.update({ where: { id }, data: entrada, select: CAMPOS })
      await this.auditoria.registrarVarios(
        tx,
        entradasDaAlteracao('Time', id, diff, 'ativo', ACOES_DA_ALTERACAO),
      )
      return paraDto(depois, atleticaId)
    })
  }

  /** Exclusão física só sem dependências (RN26); a FK `Restrict` cobre as fora do escopo. */
  async excluir(id: string): Promise<void> {
    await this.gravar(async (tx) => {
      const antes = await this.buscar(tx, id)
      if (await this.temDependencias(tx, id)) throw erroTimeComDependencias()

      await tx.time.delete({ where: { id } })
      await this.auditoria.registrar(tx, {
        entidade: 'Time',
        acao: 'TIME_EXCLUIDO',
        entidadeId: id,
        dados: { antes: auditaveis(antes), depois: null },
      })
    })
  }

  /** O índice `time_nome_unico` decide a unicidade, inclusive na corrida. */
  private async gravar<T>(fn: (tx: TransacaoComEscopo) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.db.$transaction(fn)
    } catch (erro) {
      if (erro instanceof PrismaClientKnownRequestError) {
        if (erro.code === 'P2002') throw erroTimeDuplicado()
        if (erro.code === 'P2003') throw erroTimeComDependencias()
      }
      throw erro
    }
  }

  private async buscar(tx: TransacaoComEscopo, id: string): Promise<LinhaTime> {
    const time = await tx.time.findUnique({ where: { id }, select: CAMPOS })
    if (!time) throw erroTimeNaoEncontrado()
    return time
  }

  private async buscarAdversaria(tx: TransacaoComEscopo, id: string): Promise<string> {
    const adversaria = await tx.atletica.findFirst({
      where: { id, usaAplicativo: false },
      select: { id: true },
    })
    if (!adversaria) throw erroAdversariaNaoEncontrada('atleticaAdversariaId')
    return adversaria.id
  }

  private async validarModalidade(tx: TransacaoComEscopo, id: string): Promise<void> {
    const modalidade = await tx.modalidade.findUnique({ where: { id }, select: { ativa: true } })
    if (!modalidade) throw erroModalidadeNaoEncontrada('modalidadeId')
    if (!modalidade.ativa) throw erroModalidadeInativa()
  }

  /** Eventos em qualquer status, como time ou adversário (RN11). */
  private async garantirSemEventos(tx: TransacaoComEscopo, id: string): Promise<void> {
    const eventos = await tx.evento.count({ where: eventosDoTime(id) })
    if (eventos > 0) throw erroTimeComEventos()
  }

  private async temDependencias(tx: TransacaoComEscopo, id: string): Promise<boolean> {
    const contagens = [
      await tx.evento.count({ where: eventosDoTime(id) }),
      await tx.membroTime.count({ where: { timeId: id } }),
      await tx.solicitacaoEntrada.count({ where: { timeId: id } }),
    ]
    return contagens.some((total) => total > 0)
  }
}
