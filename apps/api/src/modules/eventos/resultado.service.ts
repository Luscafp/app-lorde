import { calcularResultado, type EventoDto, type RegistrarResultado } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { AuditoriaService } from '../auditoria/auditoria.service'
import { diferenca } from '../auditoria/diferenca'
import {
  erroConflitoStatus,
  erroEventoCancelado,
  erroEventoNaoEJogo,
  erroEventoNaoFinalizado,
} from './erros'
import { EventosStatusService } from './eventos-status.service'
import type { AutorEvento } from './eventos.service'
import { buscarEvento, paraDto } from './linha-evento'

const CAMPOS_PLACAR = ['placarTime', 'placarAdversario', 'resultado'] as const

/** Registro e correção do placar de jogos, com resultado calculado no servidor (épico #21 §7). */
@Injectable()
export class ResultadoService {
  constructor(
    private readonly transacao: TransacaoService,
    private readonly auditoria: AuditoriaService,
    private readonly dominio: EventosDominioService,
    private readonly status: EventosStatusService,
  ) {}

  /** `finalizar` finaliza e registra atomicamente (UC17 A1); mesmo placar é no-op. */
  registrar(id: string, entrada: RegistrarResultado, autor: AutorEvento): Promise<EventoDto> {
    return this.transacao.executar(async (tx) => {
      const antes = await buscarEvento(tx, id)
      if (antes.tipo !== 'JOGO') throw erroEventoNaoEJogo()
      if (antes.status === 'CANCELADO') {
        throw erroEventoCancelado('Evento cancelado não aceita resultado.')
      }
      if (antes.status !== 'FINALIZADO') {
        if (!entrada.finalizar) throw erroEventoNaoFinalizado()
        await this.status.trocar(tx, id, antes.status, 'FINALIZADO')
      }

      const { placarTime, placarAdversario } = entrada
      const placar = {
        placarTime,
        placarAdversario,
        resultado: calcularResultado(placarTime, placarAdversario),
      }
      const diff = diferenca(antes, { ...antes, ...placar }, CAMPOS_PLACAR)
      if (!diff) return paraDto(antes)

      const { count } = await tx.evento.updateMany({
        where: {
          id,
          status: 'FINALIZADO',
          placarTime: antes.placarTime,
          placarAdversario: antes.placarAdversario,
          resultado: antes.resultado,
        },
        data: placar,
      })
      if (count === 0) throw erroConflitoStatus()

      const primeiroRegistro = antes.resultado === null
      await this.auditoria.registrar(tx, {
        entidade: 'Evento',
        acao: primeiroRegistro ? 'RESULTADO_REGISTRADO' : 'RESULTADO_CORRIGIDO',
        entidadeId: id,
        dados: diff,
      })
      if (primeiroRegistro) {
        this.dominio.emitirAposCommit('evento.resultadoRegistrado', {
          atleticaId: autor.atleticaId,
          eventoId: id,
          autorId: autor.id,
        })
      }
      return paraDto(await buscarEvento(tx, id))
    })
  }
}
