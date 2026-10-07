import {
  StatusSolicitacao,
  type ListaSolicitacoes,
  type ListarSolicitacoesQuery,
  type SolicitacaoPainelDto,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { paginarPorSql } from '../../common/busca'
import { Prisma } from '../../generated/prisma/client'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import type { StatusAvaliacao } from '../../infra/eventos/eventos-dominio'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService, type EntradaAuditoria } from '../auditoria/auditoria.service'
import { CAMPOS_MEMBRO, identidadeMembro } from '../times/membro'
import { UploadsService } from '../uploads/uploads.service'
import {
  erroSolicitacaoCancelada,
  erroSolicitacaoJaAvaliada,
  erroSolicitacaoNaoEncontrada,
  erroTimeInativo,
} from './erros'

const CAMPOS_ITEM = {
  id: true,
  status: true,
  criadaEm: true,
  avaliadaEm: true,
  canceladaEm: true,
  usuario: { select: CAMPOS_MEMBRO },
  avaliadoPor: { select: CAMPOS_MEMBRO },
  time: {
    select: {
      id: true,
      nome: true,
      modalidade: { select: { id: true, nome: true, icone: true } },
    },
  },
} as const satisfies Prisma.SolicitacaoEntradaSelect

type LinhaItem = Prisma.SolicitacaoEntradaGetPayload<{ select: typeof CAMPOS_ITEM }>

interface Avaliada {
  id: string
  atleticaId: string
  timeId: string
  usuarioId: string
}

/** `$queryRaw` não passa pela extensão multi-atlética: o filtro de atlética vai no SQL. */
function filtrosDaLista(atleticaId: string, { status, timeId }: ListarSolicitacoesQuery) {
  const condicoes = [
    Prisma.sql`s."atleticaId" = ${atleticaId}::uuid`,
    Prisma.sql`s."status" = ANY(${status}::"StatusSolicitacao"[])`,
  ]
  if (timeId) condicoes.push(Prisma.sql`s."timeId" = ${timeId}::uuid`)
  return Prisma.join(condicoes, ' AND ')
}

/** Pendentes: mais antigas primeiro; histórico: encerramento mais recente primeiro. */
function ordemDaLista(status: StatusSolicitacao[]): Prisma.Sql {
  const soPendentes = status.length === 1 && status[0] === StatusSolicitacao.PENDENTE
  return soPendentes
    ? Prisma.sql`s."criadaEm" ASC, s."id" ASC`
    : Prisma.sql`COALESCE(s."avaliadaEm", s."canceladaEm") DESC, s."criadaEm" DESC, s."id" DESC`
}

/** Avaliação das solicitações de entrada pela Diretoria (épico #18 §7, UC20, issue #69). */
@Injectable()
export class SolicitacoesPainelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transacao: TransacaoService,
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventosDominioService,
    private readonly uploads: UploadsService,
  ) {}

  async listar(atleticaId: string, query: ListarSolicitacoesQuery): Promise<ListaSolicitacoes> {
    const origem = Prisma.sql`FROM "SolicitacaoEntrada" s WHERE ${filtrosDaLista(atleticaId, query)}`
    const pagina = await paginarPorSql(this.prisma.db, query, {
      ids: Prisma.sql`SELECT s."id" ${origem} ORDER BY ${ordemDaLista(query.status)}`,
      total: Prisma.sql`SELECT count(*) AS "total" ${origem}`,
      buscar: (ids) =>
        this.prisma.db.solicitacaoEntrada.findMany({
          where: { id: { in: ids } },
          select: CAMPOS_ITEM,
        }),
    })
    return { ...pagina, items: pagina.items.map((linha) => this.paraItem(linha)) }
  }

  /** Cria o vínculo no elenco na mesma transação; vínculo ativo já existente não é duplicado. */
  aprovar(id: string, avaliadorId: string): Promise<SolicitacaoPainelDto> {
    return this.transacao.executar(async (tx) => {
      const solicitacao = await tx.solicitacaoEntrada.findUnique({
        where: { id },
        select: { time: { select: { ativo: true, modalidade: { select: { ativa: true } } } } },
      })
      if (!solicitacao) throw erroSolicitacaoNaoEncontrada()
      const { time } = solicitacao
      if (!time.ativo || !time.modalidade.ativa) throw erroTimeInativo()

      const avaliada = await this.avaliar(tx, id, StatusSolicitacao.APROVADA, avaliadorId)
      const { timeId, usuarioId } = avaliada
      const [membro] = await tx.membroTime.createManyAndReturn({
        data: [{ atleticaId: avaliada.atleticaId, timeId, usuarioId, solicitacaoId: id }],
        skipDuplicates: true,
        select: { id: true, entradaEm: true },
      })

      const entradas: EntradaAuditoria[] = [
        {
          entidade: 'SolicitacaoEntrada',
          acao: 'SOLICITACAO_APROVADA',
          entidadeId: id,
          dados: {
            antes: { status: StatusSolicitacao.PENDENTE },
            depois: { status: StatusSolicitacao.APROVADA },
            contexto: { timeId, usuarioId, ...(!membro && { jaEraMembro: true }) },
          },
        },
      ]
      if (membro) {
        entradas.push({
          entidade: 'MembroTime',
          acao: 'MEMBRO_ADICIONADO',
          entidadeId: membro.id,
          dados: {
            antes: null,
            depois: { timeId, usuarioId, entradaEm: membro.entradaEm },
            contexto: { solicitacaoId: id },
          },
        })
      }
      await this.auditoria.registrarVarios(tx, entradas)
      return this.concluir(tx, avaliada, StatusSolicitacao.APROVADA, avaliadorId)
    })
  }

  /** Sem motivo e sem checar time inativo (épico #18 §7). */
  rejeitar(id: string, avaliadorId: string): Promise<SolicitacaoPainelDto> {
    return this.transacao.executar(async (tx) => {
      const avaliada = await this.avaliar(tx, id, StatusSolicitacao.REJEITADA, avaliadorId)
      await this.auditoria.registrar(tx, {
        entidade: 'SolicitacaoEntrada',
        acao: 'SOLICITACAO_REJEITADA',
        entidadeId: id,
        dados: {
          antes: { status: StatusSolicitacao.PENDENTE },
          depois: { status: StatusSolicitacao.REJEITADA },
          contexto: { timeId: avaliada.timeId, usuarioId: avaliada.usuarioId },
        },
      })
      return this.concluir(tx, avaliada, StatusSolicitacao.REJEITADA, avaliadorId)
    })
  }

  /** Transição condicional (épico #18 §14): a releitura só escolhe o código do erro. */
  private async avaliar(
    tx: TransacaoComEscopo,
    id: string,
    status: StatusAvaliacao,
    avaliadoPorId: string,
  ): Promise<Avaliada> {
    const [avaliada] = await tx.solicitacaoEntrada.updateManyAndReturn({
      where: { id, status: StatusSolicitacao.PENDENTE },
      data: { status, avaliadaEm: new Date(), avaliadoPorId },
      select: { id: true, atleticaId: true, timeId: true, usuarioId: true },
    })
    if (avaliada) return avaliada

    const atual = await tx.solicitacaoEntrada.findUnique({
      where: { id },
      select: { status: true },
    })
    if (!atual) throw erroSolicitacaoNaoEncontrada()
    if (atual.status === StatusSolicitacao.CANCELADA) throw erroSolicitacaoCancelada()
    throw erroSolicitacaoJaAvaliada()
  }

  private async concluir(
    tx: TransacaoComEscopo,
    avaliada: Avaliada,
    status: StatusAvaliacao,
    autorId: string,
  ): Promise<SolicitacaoPainelDto> {
    this.eventos.emitirAposCommit('solicitacao.avaliada', {
      atleticaId: avaliada.atleticaId,
      solicitacaoId: avaliada.id,
      timeId: avaliada.timeId,
      usuarioId: avaliada.usuarioId,
      status,
      autorId,
    })
    const linha = await tx.solicitacaoEntrada.findUniqueOrThrow({
      where: { id: avaliada.id },
      select: CAMPOS_ITEM,
    })
    return this.paraItem(linha)
  }

  private paraItem({ usuario, avaliadoPor, ...linha }: LinhaItem): SolicitacaoPainelDto {
    return {
      ...linha,
      criadaEm: linha.criadaEm.toISOString(),
      avaliadaEm: linha.avaliadaEm?.toISOString() ?? null,
      canceladaEm: linha.canceladaEm?.toISOString() ?? null,
      usuario: this.pessoa(usuario),
      avaliadoPor: avaliadoPor && this.pessoa(avaliadoPor),
    }
  }

  private pessoa(usuario: LinhaItem['usuario']) {
    return { id: usuario.id, ...identidadeMembro(usuario, this.uploads) }
  }
}
