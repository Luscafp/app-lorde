import { avaliarResposta, type ParticipacaoRespondidaDto } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import { naoExcluido } from '../../infra/prisma/nao-excluido'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import type { UsuarioNaAtletica } from '../auth/tipos'
import { erroEventoNaoEncontrado } from '../eventos/erros'
import { EventosLeituraService } from '../eventos/eventos-leitura.service'
import { ELENCO_ATUAL } from '../times/membro'
import { erroRespostaBloqueada } from './erros'

interface Resposta {
  evento: { id: string; timeId: string }
  confirmado: boolean
  respondidoEm: Date
}

function corridaNaCriacao(erro: unknown): boolean {
  return erro instanceof PrismaClientKnownRequestError && erro.code === 'P2002'
}

/** Confirmação do atleta em um evento (RF17, RN30, UC15); sem auditoria nem evento de domínio. */
@Injectable()
export class ParticipacoesService {
  constructor(
    private readonly transacao: TransacaoService,
    private readonly leitura: EventosLeituraService,
  ) {}

  /** Upsert por `(eventoId, usuarioId)`; a mesma resposta não regrava `respondidoEm`. */
  async responder(
    eventoId: string,
    confirmado: boolean,
    usuario: UsuarioNaAtletica,
  ): Promise<ParticipacaoRespondidaDto> {
    const executar = () =>
      this.transacao.executar((tx) => this.gravar(tx, eventoId, confirmado, usuario))
    const resposta = await executar().catch((erro: unknown) => {
      if (corridaNaCriacao(erro)) return executar()
      throw erro
    })
    return {
      eventoId,
      confirmado: resposta.confirmado,
      respondidoEm: resposta.respondidoEm.toISOString(),
      contagem: await this.leitura.contagem(resposta.evento),
    }
  }

  /** Horário do servidor; ordem de avaliação de `avaliarResposta` (#75). */
  private async gravar(
    tx: TransacaoComEscopo,
    eventoId: string,
    confirmado: boolean,
    usuario: UsuarioNaAtletica,
  ): Promise<Resposta> {
    const evento = await tx.evento.findFirst({
      where: { id: eventoId, ...naoExcluido },
      select: { id: true, status: true, inicio: true, timeId: true },
    })
    if (!evento) throw erroEventoNaoEncontrado()

    const membros = await tx.membroTime.count({
      where: { timeId: evento.timeId, usuarioId: usuario.id, ...ELENCO_ATUAL },
    })
    const agora = new Date()
    const { motivoBloqueioResposta } = avaliarResposta(evento, membros > 0, agora)
    if (motivoBloqueioResposta) throw erroRespostaBloqueada(motivoBloqueioResposta)

    const chave = { eventoId_usuarioId: { eventoId, usuarioId: usuario.id } }
    const campos = { confirmado: true, respondidoEm: true } as const
    const atual = await tx.participacao.findUnique({ where: chave, select: campos })
    if (atual?.confirmado === confirmado && atual.respondidoEm) {
      return { evento, confirmado, respondidoEm: atual.respondidoEm }
    }

    const gravada = await tx.participacao.upsert({
      where: chave,
      create: {
        atleticaId: usuario.atleticaId,
        eventoId,
        usuarioId: usuario.id,
        confirmado,
        respondidoEm: agora,
      },
      update: { confirmado, respondidoEm: agora },
      select: campos,
    })
    return { evento, confirmado, respondidoEm: gravada.respondidoEm ?? agora }
  }
}
