import {
  transicaoPermitida,
  type Resultado,
  type StatusEvento,
  type StatusEventoAlteradoDto,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { naoExcluido } from '../../infra/prisma/nao-excluido'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService } from '../auditoria/auditoria.service'
import { erroConflitoStatus, erroEventoNaoEncontrado, erroTransicaoInvalida } from './erros'
import { EventosService, type AutorEvento } from './eventos.service'

interface EventoLido {
  status: StatusEvento
  timeId: string
  resultado: Resultado | null
}

/** Troca manual de status pela máquina de estados (épico #21 §4, issue #73). */
@Injectable()
export class EventosStatusService {
  constructor(
    private readonly transacao: TransacaoService,
    private readonly auditoria: AuditoriaService,
    private readonly dominio: EventosDominioService,
    private readonly eventos: EventosService,
  ) {}

  /** Mesmo status: 200 sem auditoria nem evento de domínio. */
  alterar(id: string, para: StatusEvento, autor: AutorEvento): Promise<StatusEventoAlteradoDto> {
    return this.transacao.executar(async (tx) => {
      const evento = await tx.evento.findFirst({
        where: { id, ...naoExcluido },
        select: { status: true, timeId: true, resultado: true },
      })
      if (!evento) throw erroEventoNaoEncontrado()

      const de = evento.status
      const resposta = { id, status: para, statusAnterior: de }
      if (de === para) return resposta

      await this.validarTransicao(tx, id, evento, para)
      if (para === 'CANCELADO') {
        await this.cancelar(tx, id, evento, autor)
        return resposta
      }

      await this.trocar(tx, id, de, para)
      this.dominio.emitirAposCommit('evento.alterado', {
        atleticaId: autor.atleticaId,
        eventoIds: [id],
        timeId: evento.timeId,
        campos: ['status'],
        autorId: autor.id,
      })
      return resposta
    })
  }

  /** Atualização condicional ao status lido, com auditoria; quem chama emite o evento. */
  async trocar(
    tx: TransacaoComEscopo,
    id: string,
    de: StatusEvento,
    para: StatusEvento,
  ): Promise<void> {
    const { count } = await tx.evento.updateMany({
      where: { id, status: de },
      data: { status: para },
    })
    if (count === 0) throw erroConflitoStatus()

    await this.auditoria.registrar(tx, {
      entidade: 'Evento',
      acao: 'EVENTO_STATUS_ALTERADO',
      entidadeId: id,
      dados: { antes: { status: de }, depois: { status: para } },
    })
  }

  private async validarTransicao(
    tx: TransacaoComEscopo,
    id: string,
    evento: EventoLido,
    para: StatusEvento,
  ): Promise<void> {
    const de = evento.status
    if (!transicaoPermitida(de, para)) throw erroTransicaoInvalida(de, para)
    if (de === 'FINALIZADO' && evento.resultado !== null) {
      throw erroTransicaoInvalida(de, para, 'O jogo já tem resultado registrado.')
    }
    if (de === 'EM_ANDAMENTO' && para === 'AGENDADO' && (await this.temPresenca(tx, id))) {
      throw erroTransicaoInvalida(de, para, 'O evento já tem presença registrada.')
    }
  }

  /** Presença é gravada pela #84; até lá a guarda sempre passa. */
  private async temPresenca(tx: TransacaoComEscopo, eventoId: string): Promise<boolean> {
    const total = await tx.participacao.count({ where: { eventoId, presente: { not: null } } })
    return total > 0
  }

  private async cancelar(
    tx: TransacaoComEscopo,
    id: string,
    evento: EventoLido,
    autor: AutorEvento,
  ): Promise<void> {
    const eventoIds = await this.eventos.cancelar(tx, [id], autor, evento.status)
    if (eventoIds.length === 0) throw erroConflitoStatus()

    this.dominio.emitirAposCommit('evento.cancelado', {
      atleticaId: autor.atleticaId,
      eventoIds,
      timeId: evento.timeId,
      autorId: autor.id,
    })
  }
}
