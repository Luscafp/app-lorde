import {
  StatusSolicitacao,
  type MinhaSituacaoDto,
  type SolicitacaoDto,
  type TimeDto,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import type { Prisma } from '../../generated/prisma/client'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import type { UsuarioNaAtletica } from '../auth/tipos'
import { erroTimeNaoEncontrado } from '../times/erros'
import { ELENCO_ATUAL } from '../times/membro'
import {
  erroJaEMembro,
  erroSolicitacaoJaAvaliada,
  erroSolicitacaoNaoEncontrada,
  erroSolicitacaoPendente,
  erroTimeAdversarioSemSolicitacao,
  erroTimeInativo,
} from './erros'

const CAMPOS_SOLICITACAO = {
  id: true,
  timeId: true,
  status: true,
  criadaEm: true,
  canceladaEm: true,
} as const satisfies Prisma.SolicitacaoEntradaSelect

type LinhaSolicitacao = Prisma.SolicitacaoEntradaGetPayload<{ select: typeof CAMPOS_SOLICITACAO }>

const AVALIADAS: StatusSolicitacao[] = [StatusSolicitacao.APROVADA, StatusSolicitacao.REJEITADA]

function paraDto(linha: LinhaSolicitacao): SolicitacaoDto {
  return {
    ...linha,
    criadaEm: linha.criadaEm.toISOString(),
    canceladaEm: linha.canceladaEm?.toISOString() ?? null,
  }
}

function pendente(timeId: string, usuarioId: string) {
  return { timeId, usuarioId, status: StatusSolicitacao.PENDENTE }
}

/** Solicitações de entrada do atleta nos times da atlética ativa (épico #18, RN21, RN27–RN29). */
@Injectable()
export class SolicitacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transacao: TransacaoService,
    private readonly eventos: EventosDominioService,
  ) {}

  /** O índice `solicitacao_pendente_unica` decide a corrida (RN27); sem auditoria (§7). */
  async criar(timeId: string, solicitante: UsuarioNaAtletica): Promise<SolicitacaoDto> {
    try {
      return await this.transacao.executar(async (tx) => {
        await this.validarTime(tx, timeId, solicitante.id)
        const criada = await tx.solicitacaoEntrada.create({
          data: { atleticaId: solicitante.atleticaId, timeId, usuarioId: solicitante.id },
          select: CAMPOS_SOLICITACAO,
        })
        this.eventos.emitirAposCommit('solicitacao.criada', {
          atleticaId: solicitante.atleticaId,
          solicitacaoId: criada.id,
          timeId,
          autorId: solicitante.id,
        })
        return paraDto(criada)
      })
    } catch (erro) {
      if (erro instanceof PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw erroSolicitacaoPendente()
      }
      throw erro
    }
  }

  /** Transição condicional; já cancelada responde o estado atual (idempotente). */
  async cancelar(id: string, usuarioId: string): Promise<SolicitacaoDto> {
    const minha = { id, usuarioId }
    await this.prisma.db.solicitacaoEntrada.updateMany({
      where: { ...minha, status: StatusSolicitacao.PENDENTE },
      data: { status: StatusSolicitacao.CANCELADA, canceladaEm: new Date() },
    })
    const atual = await this.prisma.db.solicitacaoEntrada.findFirst({
      where: minha,
      select: CAMPOS_SOLICITACAO,
    })
    if (!atual) throw erroSolicitacaoNaoEncontrada()
    if (AVALIADAS.includes(atual.status)) throw erroSolicitacaoJaAvaliada()
    return paraDto(atual)
  }

  async minhaSituacao(
    time: Pick<TimeDto, 'id' | 'atletica'>,
    usuarioId: string,
  ): Promise<MinhaSituacaoDto | null> {
    if (!time.atletica.propria) return null
    const [membros, solicitacao] = await Promise.all([
      this.prisma.db.membroTime.count({ where: { timeId: time.id, usuarioId, ...ELENCO_ATUAL } }),
      this.prisma.db.solicitacaoEntrada.findFirst({
        where: pendente(time.id, usuarioId),
        select: { id: true, criadaEm: true },
      }),
    ])
    return {
      membro: membros > 0,
      solicitacaoPendente: solicitacao && {
        id: solicitacao.id,
        criadaEm: solicitacao.criadaEm.toISOString(),
      },
    }
  }

  /** Ordem da §7 do épico: escopo → próprio → ativo → não membro → sem pendente. */
  private async validarTime(
    tx: TransacaoComEscopo,
    timeId: string,
    usuarioId: string,
  ): Promise<void> {
    const time = await tx.time.findUnique({
      where: { id: timeId },
      select: {
        ativo: true,
        modalidade: { select: { ativa: true } },
        atletica: { select: { usaAplicativo: true } },
      },
    })
    if (!time) throw erroTimeNaoEncontrado()
    if (!time.atletica.usaAplicativo) throw erroTimeAdversarioSemSolicitacao()
    if (!time.ativo || !time.modalidade.ativa) throw erroTimeInativo()

    const membros = await tx.membroTime.count({ where: { timeId, usuarioId, ...ELENCO_ATUAL } })
    if (membros > 0) throw erroJaEMembro()
    const pendentes = await tx.solicitacaoEntrada.count({ where: pendente(timeId, usuarioId) })
    if (pendentes > 0) throw erroSolicitacaoPendente()
  }
}
