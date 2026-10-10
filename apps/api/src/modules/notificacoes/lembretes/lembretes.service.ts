import { ANTECEDENCIA_PADRAO, rotaNotificacao } from '@atletica/shared'
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import type { Prisma } from '../../../generated/prisma/client'
import { ContextoAtletica } from '../../../infra/contexto/contexto-atletica.service'
import type { FilasDominio, NomeFila } from '../../../infra/fila/filas-dominio'
import { FilaService } from '../../../infra/fila/fila.service'
import { naoExcluido } from '../../../infra/prisma/nao-excluido'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { DestinatariosService } from '../destinatarios.service'
import { NotificacoesService } from '../notificacoes.service'
import {
  ANTECEDENCIA_CONFIRMACAO_HORAS,
  chaveJob,
  CRON_RECONCILIACAO,
  FILA_CONFIRMACAO_PENDENTE,
  FILA_LEMBRETE,
  FILA_RECONCILIAR,
  JANELA_RECONCILIACAO_MS,
  motivoDescarte,
  planejarJobs,
  recebeConfirmacaoPendente,
  type EventoAgendavel,
  type JobPlanejado,
} from './agenda'
import { textoConfirmacaoPendente, textoLembrete, type EventoDoTexto } from './textos'

type PayloadLembrete = FilasDominio[typeof FILA_LEMBRETE]
type PayloadConfirmacao = FilasDominio[typeof FILA_CONFIRMACAO_PENDENTE]

const SELECAO_EXECUCAO = {
  id: true,
  atleticaId: true,
  tipo: true,
  timeId: true,
  inicio: true,
  local: true,
  status: true,
  criadoEm: true,
  excluidoEm: true,
  time: { select: { nome: true } },
} as const satisfies Prisma.EventoSelect

type EventoVigente = EventoAgendavel & EventoDoTexto & { atleticaId: string; timeId: string }

/** Sem preferência gravada vale a antecedência padrão (épico #36 §4). */
function filtroAntecedencia(horas: number): Prisma.UsuarioWhereInput[] {
  return [
    { preferencia: { is: { antecedenciaLembreteHoras: horas } } },
    ...(horas === ANTECEDENCIA_PADRAO ? [{ preferencia: { is: null } }] : []),
  ]
}

/** Lembretes e "Você vai?" por reconciliação + jobs atrasados (épico #36 §3.5 itens 12–14). */
@Injectable()
export class LembretesService implements OnModuleInit {
  private readonly logger = new Logger(LembretesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly fila: FilaService,
    private readonly contexto: ContextoAtletica,
    private readonly destinatarios: DestinatariosService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async onModuleInit(): Promise<void> {
    const opcoes = { policy: 'exclusive', retryLimit: 3, retryBackoff: true } as const
    await this.fila.criarFila(FILA_LEMBRETE, opcoes)
    await this.fila.criarFila(FILA_CONFIRMACAO_PENDENTE, opcoes)
    await this.fila.criarFila(FILA_RECONCILIAR, { policy: 'exclusive' })
    await this.fila.trabalhar(FILA_RECONCILIAR, async () => {
      await this.reconciliar()
    })
    await this.fila.trabalhar(FILA_LEMBRETE, (payload) => this.lembrar(payload))
    await this.fila.trabalhar(FILA_CONFIRMACAO_PENDENTE, (payload) =>
      this.confirmarPendente(payload),
    )
    await this.fila.agendar(FILA_RECONCILIAR, CRON_RECONCILIACAO)
  }

  /** Todas as atléticas com app, cada uma no próprio contexto; devolve os jobs criados. */
  async reconciliar(agora = new Date()): Promise<number> {
    const atleticas = await this.prisma.db.atletica.findMany({
      where: { usaAplicativo: true },
      select: { id: true },
    })
    let criados = 0
    for (const { id } of atleticas) {
      criados += await this.reconciliarEventos(id, {}, agora)
    }
    this.logger.log({ fila: FILA_RECONCILIAR, criados }, 'Lembretes reconciliados')
    return criados
  }

  /** Só os eventos do `filtro` (ouvintes de `evento.criado` e `evento.alterado`). */
  reconciliarEventos(
    atleticaId: string,
    filtro: Prisma.EventoWhereInput,
    agora = new Date(),
  ): Promise<number> {
    return this.contexto.executarComAtletica(atleticaId, async () => {
      const eventos = await this.prisma.db.evento.findMany({
        where: {
          AND: [filtro],
          ...naoExcluido,
          status: 'AGENDADO',
          inicio: { gt: agora, lte: new Date(agora.getTime() + JANELA_RECONCILIACAO_MS) },
        },
        select: { id: true, inicio: true, criadoEm: true },
      })
      let criados = 0
      for (const evento of eventos) {
        for (const job of planejarJobs(evento, agora)) {
          if (await this.agendarJob(atleticaId, evento, job)) criados += 1
        }
      }
      return criados
    })
  }

  /** Elenco atual que confirmou e escolheu esta antecedência, lida na execução. */
  async lembrar(
    { eventoId, horas, inicioPrevisto }: PayloadLembrete,
    agora = new Date(),
  ): Promise<void> {
    const evento = await this.eventoVigente(FILA_LEMBRETE, { eventoId, inicioPrevisto }, agora)
    if (!evento) return
    const elenco = await this.destinatarios.elencoDoTime(evento.timeId)
    const confirmados = await this.prisma.db.participacao.findMany({
      where: {
        eventoId,
        confirmado: true,
        usuarioId: { in: elenco },
        usuario: { OR: filtroAntecedencia(horas) },
      },
      select: { usuarioId: true },
    })
    await this.enviar(
      evento,
      confirmados.map(({ usuarioId }) => usuarioId),
      textoLembrete(evento, horas),
      chaveJob(FILA_LEMBRETE, eventoId, horas, evento.inicio),
      agora,
    )
  }

  /** Elenco atual sem resposta (sem `Participacao` ou com `confirmado` nulo). */
  async confirmarPendente(
    { eventoId, inicioPrevisto }: PayloadConfirmacao,
    agora = new Date(),
  ): Promise<void> {
    const evento = await this.eventoVigente(
      FILA_CONFIRMACAO_PENDENTE,
      { eventoId, inicioPrevisto },
      agora,
    )
    if (!evento || !recebeConfirmacaoPendente(evento)) return
    const elenco = await this.destinatarios.elencoDoTime(evento.timeId)
    const respostas = await this.prisma.db.participacao.findMany({
      where: { eventoId, confirmado: { not: null } },
      select: { usuarioId: true },
    })
    const responderam = new Set(respostas.map(({ usuarioId }) => usuarioId))
    await this.enviar(
      evento,
      elenco.filter((usuarioId) => !responderam.has(usuarioId)),
      textoConfirmacaoPendente(evento),
      chaveJob(FILA_CONFIRMACAO_PENDENTE, eventoId, ANTECEDENCIA_CONFIRMACAO_HORAS, evento.inicio),
      agora,
    )
  }

  /** `null` quando o job ficou obsoleto (épico #36 §3.5 item 12). */
  private async eventoVigente(
    fila: NomeFila,
    { eventoId, inicioPrevisto }: Pick<PayloadConfirmacao, 'eventoId' | 'inicioPrevisto'>,
    agora: Date,
  ): Promise<EventoVigente | null> {
    const evento = await this.prisma.db.evento.findUnique({
      where: { id: eventoId },
      select: SELECAO_EXECUCAO,
    })
    const motivo = motivoDescarte(evento, inicioPrevisto, agora)
    if (motivo || !evento) {
      this.logger.log({ fila, eventoId, motivo }, 'Job obsoleto descartado')
      return null
    }
    return evento
  }

  private agendarJob(
    atleticaId: string,
    { id: eventoId, inicio }: EventoAgendavel,
    { fila, horas, startAfter, singletonKey }: JobPlanejado,
  ): Promise<string | null> {
    const base = { atleticaId, eventoId, inicioPrevisto: inicio.toISOString() }
    const opcoes = { startAfter, singletonKey }
    return fila === FILA_LEMBRETE
      ? this.fila.enviar(FILA_LEMBRETE, { ...base, horas }, opcoes)
      : this.fila.enviar(FILA_CONFIRMACAO_PENDENTE, base, opcoes)
  }

  /** Jobs do sistema: não há autor a remover; o `ttl` vence no início do evento. */
  private async enviar(
    evento: EventoVigente,
    usuarioIds: string[],
    texto: { titulo: string; corpo: string },
    chave: string,
    agora: Date,
  ): Promise<void> {
    const { destinatarios } = await this.notificacoes.notificar({
      atleticaId: evento.atleticaId,
      categoria: 'LEMBRETES',
      usuarioIds,
      ...texto,
      url: rotaNotificacao({ tela: 'evento', id: evento.id }),
      chave,
      ttl: Math.floor((evento.inicio.getTime() - agora.getTime()) / 1000),
    })
    this.logger.log({ chave, destinatarios }, 'Lembrete enfileirado')
  }
}
