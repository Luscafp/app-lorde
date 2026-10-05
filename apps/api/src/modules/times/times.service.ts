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
import { naOrdemDosIds, padraoLike } from '../../common/busca'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService, type EntradaAuditoria } from '../auditoria/auditoria.service'
import { diferenca, type DiferencaAuditoria } from '../auditoria/diferenca'
import {
  erroAdversariaNaoEncontrada,
  erroModalidadeInativa,
  erroModalidadeNaoEncontrada,
  erroTimeComDependencias,
  erroTimeComEventos,
  erroTimeDuplicado,
  erroTimeNaoEncontrado,
} from './erros'

const CAMPOS = {
  id: true,
  nome: true,
  ativo: true,
  atleticaId: true,
  modalidadeId: true,
  modalidade: { select: { id: true, nome: true, icone: true } },
  atletica: { select: { id: true, nome: true, sigla: true } },
  capitao: { select: { id: true, nome: true } },
  _count: { select: { membros: { where: { saidaEm: null } } } },
} as const satisfies Prisma.TimeSelect

type LinhaTime = Prisma.TimeGetPayload<{ select: typeof CAMPOS }>

type EntradaTime = Extract<EntradaAuditoria, { entidade: 'Time' }>

/** Visível para quem não é da Diretoria: time e modalidade ativos (épico #16 §7). */
const VISIVEL_PARA_TODOS = { ativo: true, modalidade: { ativa: true } } as const

const CAMPOS_AUDITADOS = ['nome', 'modalidadeId', 'ativo'] as const

function auditaveis({ nome, modalidadeId, atleticaId, ativo }: LinhaTime) {
  return { nome, modalidadeId, atleticaId, ativo }
}

function paraDto(time: LinhaTime, atleticaAtual: string): TimeDto {
  const propria = time.atleticaId === atleticaAtual
  return {
    id: time.id,
    nome: time.nome,
    ativo: time.ativo,
    modalidade: time.modalidade,
    atletica: { ...time.atletica, propria },
    capitao: propria ? time.capitao : null,
    totalMembros: propria ? time._count.membros : 0,
  }
}

/** Separa a troca de `ativo` (ATIVADO/DESATIVADO) da troca de nome/modalidade (ALTERADO). */
function entradasDaAlteracao(id: string, diff: DiferencaAuditoria): EntradaTime[] {
  const { ativo: ativoAntes, ...antes } = diff.antes
  const { ativo: ativoDepois, ...depois } = diff.depois
  const entradas: EntradaTime[] = []
  const base = { entidade: 'Time', entidadeId: id } as const

  if (Object.keys(depois).length > 0) {
    entradas.push({ ...base, acao: 'TIME_ALTERADO', dados: { antes, depois } })
  }
  if (ativoDepois !== undefined) {
    entradas.push({
      ...base,
      acao: ativoDepois ? 'TIME_ATIVADO' : 'TIME_DESATIVADO',
      dados: { antes: { ativo: ativoAntes }, depois: { ativo: ativoDepois } },
    })
  }
  return entradas
}

/**
 * `$queryRaw` não passa pela extensão multi-atlética: o escopo vai no SQL. `PROPRIOS` e
 * `ADVERSARIOS` já são subconjuntos do escopo de `Time` (atlética atual ou sem aplicativo).
 */
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

function ehErroPrisma(erro: unknown, code: string): boolean {
  return erro instanceof PrismaClientKnownRequestError && erro.code === code
}

/**
 * Times da atlética ativa e de adversárias (épico #16). A extensão multi-atlética já limita a
 * leitura a `atleticaId = atual OR atletica.usaAplicativo = false` (convenções §6).
 */
@Injectable()
export class TimesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * A página é ordenada em SQL (sem acento nem caixa) e os dados vêm do Prisma. `incluirInativos`
   * já vem resolvido pelo papel (só a Diretoria).
   */
  async listar(atleticaId: string, query: TimesQuery): Promise<ListaTimes> {
    const { page, limit } = query
    const filtros = filtrosDaLista(atleticaId, query)
    const origem = Prisma.sql`FROM "Time" t
      JOIN "Atletica" a ON a."id" = t."atleticaId"
      JOIN "Modalidade" m ON m."id" = t."modalidadeId"`

    const [pagina, [contagem]] = await Promise.all([
      this.prisma.db.$queryRaw<{ id: string }[]>`
        SELECT t."id" ${origem} WHERE ${filtros}
        ORDER BY unaccent(lower(m."nome")), unaccent(lower(t."nome")), t."id"
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      this.prisma.db.$queryRaw<[{ total: bigint }]>`
        SELECT count(*) AS "total" ${origem} WHERE ${filtros}`,
    ])
    const ids = pagina.map(({ id }) => id)
    const times = await this.prisma.db.time.findMany({
      where: { id: { in: ids } },
      select: CAMPOS,
    })

    return {
      items: naOrdemDosIds(ids, times).map((time) => paraDto(time, atleticaId)),
      page,
      limit,
      total: Number(contagem?.total ?? 0),
    }
  }

  async detalhar(id: string, atleticaId: string, incluirInativos: boolean): Promise<TimeDto> {
    const time = await this.prisma.db.time.findFirst({
      where: incluirInativos ? { id } : { id, ...VISIVEL_PARA_TODOS },
      select: CAMPOS,
    })
    if (!time) throw erroTimeNaoEncontrado()
    return paraDto(time, atleticaId)
  }

  /** O `atleticaId` de `Time` não é preenchido pela extensão: vem da atlética ativa ou da adversária. */
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
      await this.auditoria.registrarVarios(tx, entradasDaAlteracao(id, diff))
      return paraDto(depois, atleticaId)
    })
  }

  /**
   * Exclusão física só sem eventos, membros (inclusive históricos) e solicitações (RN26). As FKs
   * `Restrict` cobrem dependências fora do escopo (ex.: eventos de outra atlética).
   */
  async excluir(id: string): Promise<void> {
    try {
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
    } catch (erro) {
      if (ehErroPrisma(erro, 'P2003')) throw erroTimeComDependencias()
      throw erro
    }
  }

  /** O índice `time_nome_unico` (atlética, modalidade, `lower(nome)`) decide, inclusive na corrida. */
  private async gravar<T>(fn: (tx: TransacaoComEscopo) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.db.$transaction(fn)
    } catch (erro) {
      if (ehErroPrisma(erro, 'P2002')) throw erroTimeDuplicado()
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
    if (!adversaria) throw erroAdversariaNaoEncontrada()
    return adversaria.id
  }

  private async validarModalidade(tx: TransacaoComEscopo, id: string): Promise<void> {
    const modalidade = await tx.modalidade.findUnique({ where: { id }, select: { ativa: true } })
    if (!modalidade) throw erroModalidadeNaoEncontrada()
    if (!modalidade.ativa) throw erroModalidadeInativa()
  }

  /** Eventos em qualquer status, como time ou adversário (RN11). */
  private async garantirSemEventos(tx: TransacaoComEscopo, id: string): Promise<void> {
    const eventos = await tx.evento.count({
      where: { OR: [{ timeId: id }, { timeAdversarioId: id }] },
    })
    if (eventos > 0) throw erroTimeComEventos()
  }

  private async temDependencias(tx: TransacaoComEscopo, id: string): Promise<boolean> {
    const contagens = [
      await tx.evento.count({ where: { OR: [{ timeId: id }, { timeAdversarioId: id }] } }),
      await tx.membroTime.count({ where: { timeId: id } }),
      await tx.solicitacaoEntrada.count({ where: { timeId: id } }),
    ]
    return contagens.some((total) => total > 0)
  }
}
