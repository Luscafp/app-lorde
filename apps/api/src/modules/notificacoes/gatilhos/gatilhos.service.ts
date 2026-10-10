import { rotaNotificacao, type CategoriaNotificacao } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Prisma } from '../../../generated/prisma/client'
import type {
  CampoAlteradoEvento,
  EventosDominio,
  NomeEventoDominio,
} from '../../../infra/eventos/eventos-dominio'
import { naoExcluido } from '../../../infra/prisma/nao-excluido'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { DestinatariosService } from '../destinatarios.service'
import { NotificacoesService } from '../notificacoes.service'
import {
  textoCargo,
  textoEventoCriado,
  textoEventosAlterados,
  textoEventosCancelados,
  textoNoticia,
  textoNovaSolicitacao,
  textoResultado,
  textoSerieCriada,
  textoSolicitacaoAvaliada,
  type EventoExibido,
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

interface Gatilho {
  atleticaId: string
  autorId: string | null
  categoria: CategoriaNotificacao
  usuarioIds: string[]
}

type Conteudo = Texto & { url: string }

/** O autor da ação não recebe a própria notificação; `null` (sistema) não remove ninguém (§11.8). */
export function semAutor(usuarioIds: readonly string[], autorId: string | null): string[] {
  return usuarioIds.filter((id) => id !== autorId)
}

/** Notificações imediatas dos eventos de domínio (épico #36 §3.3); roda em `executarComAtletica`. */
@Injectable()
export class GatilhosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly destinatarios: DestinatariosService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async eventoCriado({
    atleticaId,
    eventoId,
    timeId,
    serieId,
    autorId,
  }: EventosDominio['evento.criado']): Promise<void> {
    const usuarioIds = await this.destinatarios.elencoDoTime(timeId)
    await this.enviar(
      'evento.criado',
      { atleticaId, autorId, categoria: 'NOVOS_EVENTOS', usuarioIds },
      async () => {
        const texto = serieId ? await this.textoSerie(serieId) : await this.textoEvento(eventoId)
        return texto && { ...texto, url: rotaNotificacao({ tela: 'evento', id: eventoId }) }
      },
    )
  }

  async eventoAlterado({
    atleticaId,
    eventoIds,
    timeId,
    campos,
    autorId,
  }: EventosDominio['evento.alterado']): Promise<void> {
    if (!campos.some((campo) => CAMPOS_NOTIFICADOS.has(campo))) return
    const usuarioIds = await this.destinatarios.elencoDoTime(timeId)
    await this.enviar(
      'evento.alterado',
      { atleticaId, autorId, categoria: 'ALTERACOES_EVENTOS', usuarioIds },
      () => this.conteudoDeVarios(eventoIds, timeId, textoEventosAlterados),
    )
  }

  async eventoCancelado({
    atleticaId,
    eventoIds,
    timeId,
    autorId,
  }: EventosDominio['evento.cancelado']): Promise<void> {
    const usuarioIds = await this.destinatarios.elencoDoTime(timeId)
    await this.enviar(
      'evento.cancelado',
      { atleticaId, autorId, categoria: 'ALTERACOES_EVENTOS', usuarioIds },
      () => this.conteudoDeVarios(eventoIds, timeId, textoEventosCancelados),
    )
  }

  async resultadoRegistrado({
    atleticaId,
    eventoId,
    autorId,
  }: EventosDominio['evento.resultadoRegistrado']): Promise<void> {
    const usuarioIds = await this.destinatarios.todosDaAtletica(atleticaId)
    await this.enviar(
      'evento.resultadoRegistrado',
      { atleticaId, autorId, categoria: 'RESULTADOS', usuarioIds },
      async () => {
        const [jogo] = await this.eventos([eventoId])
        if (!jogo?.resultado || jogo.placarTime === null || jogo.placarAdversario === null) {
          return null
        }
        const { resultado, placarTime, placarAdversario } = jogo
        return {
          ...textoResultado(await this.siglaDaAtletica(atleticaId), {
            ...jogo,
            resultado,
            placarTime,
            placarAdversario,
          }),
          url: rotaNotificacao({ tela: 'evento', id: eventoId }),
        }
      },
    )
  }

  async noticiaPublicada({
    atleticaId,
    noticiaId,
    autorId,
  }: EventosDominio['noticia.publicada']): Promise<void> {
    const usuarioIds = await this.destinatarios.todosDaAtletica(atleticaId)
    await this.enviar(
      'noticia.publicada',
      { atleticaId, autorId, categoria: 'NOTICIAS', usuarioIds },
      async () => {
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
    )
  }

  async solicitacaoCriada({
    atleticaId,
    solicitacaoId,
    autorId,
  }: EventosDominio['solicitacao.criada']): Promise<void> {
    const usuarioIds = await this.destinatarios.diretoria(atleticaId)
    await this.enviar(
      'solicitacao.criada',
      { atleticaId, autorId, categoria: 'SOLICITACOES', usuarioIds },
      async () => {
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
    )
  }

  async solicitacaoAvaliada({
    atleticaId,
    timeId,
    usuarioId,
    status,
    autorId,
  }: EventosDominio['solicitacao.avaliada']): Promise<void> {
    await this.enviar(
      'solicitacao.avaliada',
      { atleticaId, autorId, categoria: 'SOLICITACOES', usuarioIds: [usuarioId] },
      async () => {
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
    )
  }

  /** RN35: `CARGO` ignora as preferências. */
  async papelAlterado({
    atleticaId,
    usuarioId,
    papelNovo,
    autorId,
  }: EventosDominio['usuario.papelAlterado']): Promise<void> {
    await this.enviar(
      'usuario.papelAlterado',
      { atleticaId, autorId, categoria: 'CARGO', usuarioIds: [usuarioId] },
      () => Promise.resolve({ ...textoCargo(papelNovo), url: rotaNotificacao({ tela: 'perfil' }) }),
    )
  }

  /** Uma mensagem por usuário por evento de domínio; a `chave` única evita lote duplicado. */
  private async enviar(
    nome: NomeEventoDominio,
    { autorId, usuarioIds, ...gatilho }: Gatilho,
    montar: () => Promise<Conteudo | null>,
  ): Promise<void> {
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

  /** Um evento abre o detalhe; vários abrem o time. */
  private async conteudoDeVarios(
    eventoIds: string[],
    timeId: string,
    montar: (eventos: [EventoExibido, ...EventoExibido[]]) => Texto,
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
    const { nome, sigla } = await this.prisma.db.atletica.findUniqueOrThrow({
      where: { id: atleticaId },
      select: { nome: true, sigla: true },
    })
    return sigla ?? nome
  }
}
