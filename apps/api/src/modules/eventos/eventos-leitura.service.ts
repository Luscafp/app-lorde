import {
  avaliarResposta,
  Papel,
  temNivelMinimo,
  type ContagemParticipacao,
  type EventoDetalheDto,
  type EventoResumoDto,
  type ListaEventos,
  type ListarEventosQuery,
  type MinhaParticipacao,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client'
import { naoExcluido } from '../../infra/prisma/nao-excluido'
import { PrismaService } from '../../infra/prisma/prisma.service'
import type { UsuarioAutenticado } from '../auth/tipos'
import { VISIVEL_PARA_TODOS } from '../times/linha-time'
import { CAMPOS_MEMBRO, ELENCO_ATUAL, identidadeMembro } from '../times/membro'
import { UploadsService } from '../uploads/uploads.service'
import { erroEventoNaoEncontrado } from './erros'
import { CAMPOS_EVENTO, paraDto, paraEventoResumo } from './linha-evento'
import { filtroPeriodo, ordemPadrao } from './periodo'

const CAMPOS_DETALHE = {
  ...CAMPOS_EVENTO,
  time: { select: { ...CAMPOS_EVENTO.time.select, capitaoId: true } },
  serie: {
    select: { id: true, diasSemana: true, horario: true, dataInicio: true, dataFim: true },
  },
} as const satisfies Prisma.EventoSelect

type Leitor = Pick<UsuarioAutenticado, 'id' | 'papel'>

interface LinhaParticipacao {
  confirmado: boolean | null
  respondidoEm: Date | null
}

function minhaParticipacao(linha: LinhaParticipacao | null | undefined): MinhaParticipacao {
  if (!linha || linha.confirmado === null || !linha.respondidoEm) return null
  return { confirmado: linha.confirmado, respondidoEm: linha.respondidoEm.toISOString() }
}

function doElenco(timeId: string) {
  return { usuario: { membrosTime: { some: { timeId, ...ELENCO_ATUAL } } } }
}

/** `@db.Date` → `"aaaa-mm-dd"`. */
function dataLocal(data: Date): string {
  return data.toISOString().slice(0, 10)
}

function filtros(query: ListarEventosQuery, leitor: Leitor, agora: Date): Prisma.EventoWhereInput {
  const condicoes: Prisma.EventoWhereInput[] = [naoExcluido, filtroPeriodo(query.periodo, agora)]
  const { tipo, timeId, modalidadeId, status, resultado, serieId, aPartirDe } = query

  if (tipo) condicoes.push({ tipo })
  if (timeId) condicoes.push({ timeId })
  if (modalidadeId) condicoes.push({ time: { modalidadeId } })
  if (status) condicoes.push({ status: { in: status } })
  if (serieId) condicoes.push({ serieId })
  if (aPartirDe) condicoes.push({ inicio: { gte: new Date(aPartirDe) } })
  if (resultado) {
    condicoes.push({
      tipo: 'JOGO',
      status: 'FINALIZADO',
      resultado: resultado === 'PENDENTE' ? null : { not: null },
    })
  }
  if (query.confirmadoPorMim) {
    condicoes.push({ participacoes: { some: { usuarioId: leitor.id, confirmado: true } } })
  }
  if (!(query.incluirInativos && temNivelMinimo(leitor.papel, Papel.DIRETOR))) {
    condicoes.push({ time: VISIVEL_PARA_TODOS })
  }
  return { AND: condicoes }
}

/** Leitura de eventos para qualquer papel (épico #22, issue #75). */
@Injectable()
export class EventosLeituraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  /** Página + `count`, depois uma consulta de elenco e uma de participações (sem N+1). */
  async listar(query: ListarEventosQuery, leitor: Leitor): Promise<ListaEventos> {
    const { page, limit } = query
    const where = filtros(query, leitor, new Date())
    const ordem = query.ordem ?? ordemPadrao(query.periodo)

    const [eventos, total] = await Promise.all([
      this.prisma.db.evento.findMany({
        where,
        orderBy: [{ inicio: ordem }, { id: ordem }],
        skip: (page - 1) * limit,
        take: limit,
        select: CAMPOS_EVENTO,
      }),
      this.prisma.db.evento.count({ where }),
    ])

    const [membros, participacoes] = await Promise.all([
      this.prisma.db.membroTime.findMany({
        where: {
          usuarioId: leitor.id,
          timeId: { in: [...new Set(eventos.map(({ timeId }) => timeId))] },
          ...ELENCO_ATUAL,
        },
        select: { timeId: true },
      }),
      this.prisma.db.participacao.findMany({
        where: { usuarioId: leitor.id, eventoId: { in: eventos.map(({ id }) => id) } },
        select: { eventoId: true, confirmado: true, respondidoEm: true },
      }),
    ])
    const meusTimes = new Set(membros.map(({ timeId }) => timeId))
    const participacaoPorEvento = new Map(participacoes.map((linha) => [linha.eventoId, linha]))

    return {
      items: eventos.map((evento): EventoResumoDto => ({
        ...paraEventoResumo(paraDto(evento)),
        souMembro: meusTimes.has(evento.timeId),
        minhaParticipacao: minhaParticipacao(participacaoPorEvento.get(evento.id)),
      })),
      page,
      limit,
      total,
    }
  }

  async detalhar(id: string, leitor: Leitor): Promise<EventoDetalheDto> {
    const evento = await this.prisma.db.evento.findFirst({
      where: { id, ...naoExcluido },
      select: CAMPOS_DETALHE,
    })
    if (!evento) throw erroEventoNaoEncontrado()

    const [contagem, confirmados, minha, souMembro] = await Promise.all([
      this.contagem(evento),
      this.prisma.db.participacao.findMany({
        where: { eventoId: id, confirmado: true, ...doElenco(evento.timeId) },
        select: { usuario: { select: CAMPOS_MEMBRO } },
        orderBy: [{ usuario: { nome: 'asc' } }, { usuarioId: 'asc' }],
      }),
      this.prisma.db.participacao.findUnique({
        where: { eventoId_usuarioId: { eventoId: id, usuarioId: leitor.id } },
        select: { confirmado: true, respondidoEm: true },
      }),
      this.prisma.db.membroTime
        .count({ where: { timeId: evento.timeId, usuarioId: leitor.id, ...ELENCO_ATUAL } })
        .then((total) => total > 0),
    ])

    const { capitaoId, ...time } = evento.time
    const { serie } = evento

    return {
      ...paraDto({ ...evento, time }),
      serie: serie && {
        id: serie.id,
        diasSemana: serie.diasSemana,
        horario: serie.horario,
        dataInicio: dataLocal(serie.dataInicio),
        dataFim: dataLocal(serie.dataFim),
      },
      contagem,
      confirmados: confirmados.map(({ usuario }) => ({
        id: usuario.id,
        ...identidadeMembro(usuario, this.uploads),
        capitao: usuario.id === capitaoId,
      })),
      souMembro,
      minhaParticipacao: minhaParticipacao(minha),
      ...avaliarResposta(evento, souMembro, new Date()),
    }
  }

  /** Só o elenco atual do time conta; quem saiu mantém a resposta no banco. */
  async contagem(evento: { id: string; timeId: string }): Promise<ContagemParticipacao> {
    const [elenco, respostas] = await Promise.all([
      this.prisma.db.membroTime.count({ where: { timeId: evento.timeId, ...ELENCO_ATUAL } }),
      this.prisma.db.participacao.groupBy({
        by: ['confirmado'],
        where: { eventoId: evento.id, confirmado: { not: null }, ...doElenco(evento.timeId) },
        _count: { _all: true },
      }),
    ])
    const contar = (confirmado: boolean) =>
      respostas.find((grupo) => grupo.confirmado === confirmado)?._count._all ?? 0
    const confirmados = contar(true)
    const recusados = contar(false)
    return { confirmados, recusados, semResposta: elenco - confirmados - recusados, elenco }
  }
}
