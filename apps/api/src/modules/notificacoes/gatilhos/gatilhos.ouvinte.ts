import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import * as Sentry from '@sentry/nestjs'
import { ContextoAtletica } from '../../../infra/contexto/contexto-atletica.service'
import type { EventosDominio, NomeEventoDominio } from '../../../infra/eventos/eventos-dominio'
import { GatilhosService } from './gatilhos.service'

/** Épico #36 §7 "Ouvintes": a falha vai ao Sentry e não afeta a requisição (o commit já ocorreu). */
@Injectable()
export class GatilhosOuvinte {
  private readonly logger = new Logger(GatilhosOuvinte.name)

  constructor(
    private readonly gatilhos: GatilhosService,
    private readonly contexto: ContextoAtletica,
  ) {}

  @OnEvent('evento.criado', { async: true })
  aoCriarEvento(payload: EventosDominio['evento.criado']): Promise<void> {
    return this.executar('evento.criado', payload, () => this.gatilhos.eventoCriado(payload))
  }

  @OnEvent('evento.alterado', { async: true })
  aoAlterarEvento(payload: EventosDominio['evento.alterado']): Promise<void> {
    return this.executar('evento.alterado', payload, () => this.gatilhos.eventoAlterado(payload))
  }

  @OnEvent('evento.cancelado', { async: true })
  aoCancelarEvento(payload: EventosDominio['evento.cancelado']): Promise<void> {
    return this.executar('evento.cancelado', payload, () => this.gatilhos.eventoCancelado(payload))
  }

  @OnEvent('evento.resultadoRegistrado', { async: true })
  aoRegistrarResultado(payload: EventosDominio['evento.resultadoRegistrado']): Promise<void> {
    return this.executar('evento.resultadoRegistrado', payload, () =>
      this.gatilhos.resultadoRegistrado(payload),
    )
  }

  @OnEvent('noticia.publicada', { async: true })
  aoPublicarNoticia(payload: EventosDominio['noticia.publicada']): Promise<void> {
    return this.executar('noticia.publicada', payload, () =>
      this.gatilhos.noticiaPublicada(payload),
    )
  }

  @OnEvent('solicitacao.criada', { async: true })
  aoCriarSolicitacao(payload: EventosDominio['solicitacao.criada']): Promise<void> {
    return this.executar('solicitacao.criada', payload, () =>
      this.gatilhos.solicitacaoCriada(payload),
    )
  }

  @OnEvent('solicitacao.avaliada', { async: true })
  aoAvaliarSolicitacao(payload: EventosDominio['solicitacao.avaliada']): Promise<void> {
    return this.executar('solicitacao.avaliada', payload, () =>
      this.gatilhos.solicitacaoAvaliada(payload),
    )
  }

  @OnEvent('usuario.papelAlterado', { async: true })
  aoAlterarPapel(payload: EventosDominio['usuario.papelAlterado']): Promise<void> {
    return this.executar('usuario.papelAlterado', payload, () =>
      this.gatilhos.papelAlterado(payload),
    )
  }

  private async executar(
    nome: NomeEventoDominio,
    { atleticaId }: { atleticaId: string },
    gatilho: () => Promise<void>,
  ): Promise<void> {
    try {
      await this.contexto.executarComAtletica(atleticaId, gatilho)
    } catch (erro) {
      this.logger.error({ err: erro, evento: nome, atleticaId }, 'Falha ao notificar o gatilho')
      Sentry.captureException(erro, {
        tags: { modulo: 'notificacoes', evento: nome },
        extra: { atleticaId },
      })
    }
  }
}
