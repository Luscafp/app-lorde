import { rotaNotificacao, siglaOuNome, type CategoriaNotificacao } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Prisma } from '../../../generated/prisma/client'
import type { CampoAlteradoEvento, EventosDominio } from '../../../infra/eventos/eventos-dominio'
import { naoExcluido } from '../../../infra/prisma/nao-excluido'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { DestinatariosService } from '../destinatarios.service'
import type { ConteudoNotificacao } from '../envio/mensagens'
import { NotificacoesService } from '../notificacoes.service'
import {
  comResultado,
  textoCargo,
  textoEventoCriado,
  textoEventosAlterados,
  textoEventosCancelados,
  textoNoticia,
  textoNovaSolicitacao,
  textoResultado,
  textoSerieCriada,
  textoSolicitacaoAvaliada,
  type EventosExibidos,
  type Texto,
} from './textos'

/** Mudança só de status não notifica (convenções §11.10). */
const CAMPOS_NOTIFICADOS: ReadonlySet<CampoAlteradoEvento> = new Set(['inicio', 'local'])

const CAMPOS_EXIBICAO = {
  id: true,
  tipo: true,
  inicio: true,
  local: true,
  resultado: true,
  placarTime: true,
  placarAdversario: true,
  time: { select: { nome: true } },
  timeAdversario: { select: { atletica: { select: { nome: true } } } },
} as const satisfies Prisma.EventoSelect

export type NomeGatilho =
  | 'evento.criado'
  | 'evento.alterado'
  | 'evento.cancelado'
  | 'evento.resultadoRegistrado'
  | 'noticia.publicada'
  | 'solicitacao.criada'
  | 'solicitacao.avaliada'
  | 'usuario.papelAlterado'

type Conteudo = Pick<ConteudoNotificacao, 'titulo' | 'corpo' | 'url'>

interface Envio {
  atleticaId: string
  autorId: string | null
  categoria: CategoriaNotificacao
  usuarioIds: string[]
  montar: () => Promise<Conteudo | null>
}

type Preparadores = {
  [N in NomeGatilho]: (payload: EventosDominio[N]) => Promise<Envio | null>
}

/** O autor da ação não recebe a própria notificação; `null` (sistema) não remove ninguém (§11.8). */
export function semAutor(usuarioIds: readonly string[], autorId: string | null): string[] {
  return usuarioIds.filter((id) => id !== autorId)
}

/** Notificações imediatas dos eventos de domínio (épico #36 §3.3); roda em `executarComAtletica`. */
@Injectable()
export class GatilhosService {
  private readonly preparadores: Preparadores = {
    'evento.criado': (payload) => this.eventoCriado(payload),
    'evento.alterado': (payload) => this.eventoAlterado(payload),
    'evento.cancelado': (payload) => this.eventoCancelado(payload),
    'evento.resultadoRegistrado': (payload) => this.resultadoRegistrado(payload),
    'noticia.publicada': (payload) => this.noticiaPublicada(payload),
    'solicitacao.criada': (payload) => this.solicitacaoCriada(payload),
    'solicitacao.avaliada': (payload) => this.solicitacaoAvaliada(payload),
    'usuario.papelAlterado': (payload) => this.papelAlterado(payload),
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly destinatarios: DestinatariosService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  /** Uma mensagem por usuário por evento de domínio; a `chave` única evita lote duplicado. */
  async disparar<N extends NomeGatilho>(nome: N, payload: EventosDominio[N]): Promise<void> {
    const preparar: Preparadores[N] = this.preparadores[nome]
    const envio = await preparar(payload)
    if (!envio) return
    const { autorId, usuarioIds, montar, ...gatilho } = envio
    const destinatarios = semAutor(usuarioIds, autorId)
    if (destinatarios.length === 0) return
    const conteudo = await montar()
    if (!conteudo) return
    await this.notificacoes.notificar({
      ...gatilho,
      ...conteudo,
      usuarioIds: destinatarios,
      chave: `${nome}:${randomUUID()}`,
    })
  }

  private async eventoCriado({
    atleticaId,
    eventoId,
    timeId,
    serieId,
    autorId,
  }: EventosDominio['evento.criado']): Promise<Envio> {
    return {
      atleticaId,
      autorId,
      categoria: 'NOVOS_EVENTOS',
      usuarioIds: await this.destinatarios.elencoDoTime(timeId),
      montar: async () => {
        const texto = serieId ? await this.textoSerie(serieId) : await this.textoEvento(eventoId)
        return texto && { ...texto, url: rotaNotificacao({ tela: 'evento', id: eventoId }) }
      },
    }
  }

  private async eventoAlterado({
    atleticaId,
    eventoIds,
    timeId,
    campos,
    autorId,
  }: EventosDominio['evento.alterado']): Promise<Envio | null> {
    if (!campos.some((campo) => CAMPOS_NOTIFICADOS.has(campo))) return null
    return {
      atleticaId,
      autorId,
      categoria: 'ALTERACOES_EVENTOS',
      usuarioIds: await this.destinatarios.elencoDoTime(timeId),
      montar: () => this.conteudoDeVarios(eventoIds, timeId, textoEventosAlterados),
    }
  }

  private async eventoCancelado({
    atleticaId,
    eventoIds,
    timeId,
    autorId,
  }: EventosDominio['evento.cancelado']): Promise<Envio> {
    return {
      atleticaId,
      autorId,
      categoria: 'ALTERACOES_EVENTOS',
      usuarioIds: await this.destinatarios.elencoDoTime(timeId),
      montar: () => this.conteudoDeVarios(eventoIds, timeId, textoEventosCancelados),
    }
  }

  private async resultadoRegistrado({
    atleticaId,
    eventoId,
    autorId,
  }: EventosDominio['evento.resultadoRegistrado']): Promise<Envio> {
    return {
      atleticaId,
      autorId,
      categoria: 'RESULTADOS',
      usuarioIds: await this.destinatarios.todosDaAtletica(atleticaId),
      montar: async () => {
        const [jogo] = await this.eventos([eventoId])
        if (!jogo || !comResultado(jogo)) return null
        return {
          ...textoResultado(await this.siglaDaAtletica(atleticaId), jogo),
          url: rotaNotificacao({ tela: 'evento', id: eventoId }),
        }
      },
    }
  }

  private async noticiaPublicada({
    atleticaId,
    noticiaId,
    autorId,
  }: EventosDominio['noticia.publicada']): Promise<Envio> {
    return {
      atleticaId,
      autorId,
      categoria: 'NOTICIAS',
      usuarioIds: await this.destinatarios.todosDaAtletica(atleticaId),
      montar: async () => {
        const noticia = await this.prisma.db.noticia.findFirst({
          where: { id: noticiaId, status: 'PUBLICADA', ...naoExcluido },
          select: { titulo: true },
        })
        if (!noticia) return null
        return {
          ...textoNoticia(await this.siglaDaAtletica(atleticaId), noticia.titulo),
          url: rotaNotificacao({ tela: 'noticia', id: noticiaId }),
        }
      },
    }
  }

  private async solicitacaoCriada({
    atleticaId,
    solicitacaoId,
    autorId,
  }: EventosDominio['solicitacao.criada']): Promise<Envio> {
    return {
      atleticaId,
      autorId,
      categoria: 'SOLICITACOES',
      usuarioIds: await this.destinatarios.diretoria(atleticaId),
      montar: async () => {
        const solicitacao = await this.prisma.db.solicitacaoEntrada.findFirst({
          where: { id: solicitacaoId },
          select: { usuario: { select: { nome: true } }, time: { select: { nome: true } } },
        })
        if (!solicitacao) return null
        return {
          ...textoNovaSolicitacao(solicitacao.usuario.nome, solicitacao.time.nome),
          url: rotaNotificacao({ tela: 'solicitacoes' }),
        }
      },
    }
  }

  private solicitacaoAvaliada({
    atleticaId,
    timeId,
    usuarioId,
    status,
    autorId,
  }: EventosDominio['solicitacao.avaliada']): Promise<Envio> {
    return Promise.resolve({
      atleticaId,
      autorId,
      categoria: 'SOLICITACOES',
      usuarioIds: [usuarioId],
      montar: async () => {
        const time = await this.prisma.db.time.findFirst({
          where: { id: timeId },
          select: { nome: true },
        })
        if (!time) return null
        return {
          ...textoSolicitacaoAvaliada(status, time.nome),
          url: rotaNotificacao({ tela: 'time', id: timeId }),
        }
      },
    })
  }

  /** RN35: `CARGO` ignora as preferências. */
  private papelAlterado({
    atleticaId,
    usuarioId,
    papelNovo,
    autorId,
  }: EventosDominio['usuario.papelAlterado']): Promise<Envio> {
    return Promise.resolve({
      atleticaId,
      autorId,
      categoria: 'CARGO',
      usuarioIds: [usuarioId],
      montar: () =>
        Promise.resolve({ ...textoCargo(papelNovo), url: rotaNotificacao({ tela: 'perfil' }) }),
    })
  }

  /** Um evento abre o detalhe; vários abrem o time. */
  private async conteudoDeVarios(
    eventoIds: string[],
    timeId: string,
    montar: (eventos: EventosExibidos) => Texto,
  ): Promise<Conteudo | null> {
    const [primeiro, ...demais] = await this.eventos(eventoIds)
    if (!primeiro) return null
    const url =
      demais.length === 0
        ? rotaNotificacao({ tela: 'evento', id: primeiro.id })
        : rotaNotificacao({ tela: 'time', id: timeId })
    return { ...montar([primeiro, ...demais]), url }
  }

  private async textoEvento(eventoId: string): Promise<Texto | null> {
    const [evento] = await this.eventos([eventoId])
    return evento ? textoEventoCriado(evento) : null
  }

  private async textoSerie(serieId: string): Promise<Texto | null> {
    const serie = await this.prisma.db.serieRecorrencia.findFirst({
      where: { id: serieId },
      select: {
        diasSemana: true,
        horario: true,
        dataFim: true,
        local: true,
        time: { select: { nome: true } },
      },
    })
    return serie ? textoSerieCriada({ ...serie, time: serie.time.nome }) : null
  }

  private async eventos(ids: string[]) {
    const linhas = await this.prisma.db.evento.findMany({
      where: { id: { in: ids }, ...naoExcluido },
      select: CAMPOS_EXIBICAO,
      orderBy: { inicio: 'asc' },
    })
    return linhas.map(({ time, timeAdversario, ...evento }) => ({
      ...evento,
      time: time.nome,
      adversario: timeAdversario?.atletica.nome ?? null,
    }))
  }

  private async siglaDaAtletica(atleticaId: string): Promise<string> {
    return siglaOuNome(
      await this.prisma.db.atletica.findUniqueOrThrow({
        where: { id: atleticaId },
        select: { nome: true, sigla: true },
      }),
    )
  }
}
