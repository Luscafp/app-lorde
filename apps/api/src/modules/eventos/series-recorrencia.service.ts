import {
  chaveDiaLocal,
  EscopoOcorrencia,
  gerarDatasSerie,
  localParaUtc,
  somarDias,
  type CriarSerie,
  type EditarSeguintes,
  type EventoCanceladoDto,
  type OcorrenciasAlteradasDto,
  type SerieCriadaDto,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import type { CampoAlteradoEvento } from '../../infra/eventos/eventos-dominio'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { naoExcluido } from '../../infra/prisma/nao-excluido'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService, type EntradaAuditoria } from '../auditoria/auditoria.service'
import { diferenca, type DiferencaAuditoria } from '../auditoria/diferenca'
import {
  erroCancelamento,
  erroEventoCancelado,
  erroEventoFinalizado,
  erroEventoSemSerie,
  erroSerieSemOcorrencias,
} from './erros'
import { EventosService, type AutorEvento } from './eventos.service'
import { EventosValidator } from './eventos.validator'
import { buscarEvento } from './linha-evento'

const CAMPOS_SERIE = {
  id: true,
  timeId: true,
  diasSemana: true,
  horario: true,
  dataInicio: true,
  dataFim: true,
  local: true,
  observacoes: true,
  canceladaEm: true,
} as const satisfies Prisma.SerieRecorrenciaSelect

type LinhaSerie = Prisma.SerieRecorrenciaGetPayload<{ select: typeof CAMPOS_SERIE }>

const CAMPOS_OCORRENCIA = { id: true, inicio: true, local: true, observacoes: true } as const

type Ocorrencia = Prisma.EventoGetPayload<{ select: typeof CAMPOS_OCORRENCIA }>

const CAMPOS_EM_LOTE = ['inicio', 'local', 'observacoes'] as const

const CAMPOS_DA_SERIE = ['horario', 'local', 'observacoes'] as const

const CAMPOS_NOTIFICADOS = ['inicio', 'local'] as const satisfies CampoAlteradoEvento[]

const ESCOPO = EscopoOcorrencia.ESTA_E_SEGUINTES

/** Coluna `@db.Date`: meia-noite UTC do dia de calendário. */
function paraData(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`)
}

function dataIso(data: Date): string {
  return data.toISOString().slice(0, 10)
}

function maior(a: string, b: string): string {
  return a > b ? a : b
}

function auditavel({ id: _id, dataInicio, dataFim, ...serie }: LinhaSerie) {
  return { ...serie, dataInicio: dataIso(dataInicio), dataFim: dataIso(dataFim) }
}

/** Cada ocorrência mantém o seu dia local; só o horário, o local e as observações mudam. */
function aplicar(ocorrencia: Ocorrencia, entrada: EditarSeguintes): Ocorrencia {
  const { horario, local, observacoes } = entrada
  return {
    ...ocorrencia,
    inicio: horario ? localParaUtc(chaveDiaLocal(ocorrencia.inicio), horario) : ocorrencia.inicio,
    local: local ?? ocorrencia.local,
    observacoes: observacoes === undefined ? ocorrencia.observacoes : observacoes,
  }
}

interface Alteracao {
  id: string
  diff: DiferencaAuditoria
}

/** Treino recorrente (#20, RN13): geração síncrona na transação, sem fila (§14). */
@Injectable()
export class SeriesRecorrenciaService {
  constructor(
    private readonly transacao: TransacaoService,
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventosDominioService,
    private readonly validator: EventosValidator,
    private readonly eventosService: EventosService,
  ) {}

  criar(entrada: CriarSerie, autor: AutorEvento): Promise<SerieCriadaDto> {
    const { timeId, local, recorrencia } = entrada
    const observacoes = entrada.observacoes ?? null
    return this.transacao.executar(async (tx) => {
      await this.validator.validarTime(tx, timeId, autor.atleticaId)
      const datas = gerarDatasSerie(recorrencia)
      if (datas.length === 0) throw erroSerieSemOcorrencias()

      const serie = await tx.serieRecorrencia.create({
        data: {
          atleticaId: autor.atleticaId,
          timeId,
          diasSemana: recorrencia.diasSemana,
          horario: recorrencia.horario,
          dataInicio: paraData(recorrencia.dataInicio),
          dataFim: paraData(recorrencia.dataFim),
          local,
          observacoes,
          criadoPorId: autor.id,
        },
        select: CAMPOS_SERIE,
      })
      const ocorrencias = await tx.evento.createManyAndReturn({
        data: datas.map((inicio) => ({
          atleticaId: autor.atleticaId,
          tipo: 'TREINO' as const,
          timeId,
          serieId: serie.id,
          inicio,
          local,
          observacoes,
          criadoPorId: autor.id,
        })),
        select: { id: true, inicio: true },
      })
      ocorrencias.sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
      const primeira = ocorrencias[0]
      const ultima = ocorrencias.at(-1)
      if (!primeira || !ultima) throw erroSerieSemOcorrencias()

      await this.auditoria.registrar(tx, {
        entidade: 'SerieRecorrencia',
        acao: 'SERIE_CRIADA',
        entidadeId: serie.id,
        dados: {
          antes: null,
          depois: auditavel(serie),
          contexto: { totalOcorrencias: ocorrencias.length },
        },
      })
      this.eventos.emitirAposCommit('evento.criado', {
        atleticaId: autor.atleticaId,
        eventoId: primeira.id,
        timeId,
        serieId: serie.id,
        autorId: autor.id,
      })
      return {
        serie: {
          id: serie.id,
          timeId,
          diasSemana: serie.diasSemana,
          horario: serie.horario,
          dataInicio: recorrencia.dataInicio,
          dataFim: recorrencia.dataFim,
        },
        totalOcorrencias: ocorrencias.length,
        primeiraOcorrencia: { id: primeira.id, inicio: primeira.inicio.toISOString() },
        ultimaOcorrencia: { id: ultima.id, inicio: ultima.inicio.toISOString() },
      }
    })
  }

  /** Alvo + seguintes `AGENDADO`; divide a série quando o horário muda e há ocorrência anterior. */
  editarSeguintes(
    id: string,
    entrada: EditarSeguintes,
    autor: AutorEvento,
  ): Promise<OcorrenciasAlteradasDto> {
    return this.transacao.executar(async (tx) => {
      const alvo = await buscarEvento(tx, id)
      if (!alvo.serieId) throw erroEventoSemSerie()
      if (alvo.status === 'CANCELADO') throw erroEventoCancelado()
      if (alvo.status === 'FINALIZADO') {
        throw erroEventoFinalizado('Treino finalizado não pode ser alterado em lote.')
      }

      const serie = await tx.serieRecorrencia.findUniqueOrThrow({
        where: { id: alvo.serieId },
        select: CAMPOS_SERIE,
      })
      const seguintes = await this.seguintes(tx, serie.id, alvo.inicio, CAMPOS_OCORRENCIA)
      const anteriores = await tx.evento.count({
        where: { serieId: serie.id, inicio: { lt: alvo.inicio } },
      })
      const { horario } = entrada
      const divide = anteriores > 0 && horario !== undefined && horario !== serie.horario
      const serieId = divide
        ? await this.dividir(tx, serie, alvo.inicio, { ...entrada, horario }, autor)
        : serie.id
      if (anteriores === 0) await this.atualizarSerie(tx, serie, entrada)

      const alteracoes = [alvo, ...seguintes].flatMap((ocorrencia): Alteracao[] => {
        const diff = diferenca(ocorrencia, aplicar(ocorrencia, entrada), CAMPOS_EM_LOTE)
        return diff ? [{ id: ocorrencia.id, diff }] : []
      })
      for (const { id: eventoId, diff } of alteracoes) {
        await tx.evento.update({ where: { id: eventoId }, data: diff.depois })
      }
      await this.auditoria.registrarVarios(
        tx,
        alteracoes.map(({ id: entidadeId, diff }): EntradaAuditoria => ({
          entidade: 'Evento',
          acao: 'EVENTO_ALTERADO',
          entidadeId,
          dados: { ...diff, contexto: { serieId, escopo: ESCOPO } },
        })),
      )
      this.notificarAlteracao(alteracoes, alvo.timeId, autor)
      return {
        eventoIds: alteracoes.map((alteracao) => alteracao.id),
        serieId,
        serieDividida: divide,
      }
    })
  }

  /** Alvo (se cancelável) + seguintes `AGENDADO`; sem agendados, a série fica cancelada. */
  cancelarSeguintes(id: string, autor: AutorEvento): Promise<EventoCanceladoDto> {
    return this.transacao.executar(async (tx) => {
      const alvo = await buscarEvento(tx, id)
      const serieId = alvo.serieId
      if (!serieId) throw erroEventoSemSerie()

      const seguintes = await this.seguintes(tx, serieId, alvo.inicio, { id: true })
      const eventoIds = await this.eventosService.cancelar(
        tx,
        [alvo.id, ...seguintes.map((ocorrencia) => ocorrencia.id)],
        autor,
        { contexto: { serieId, escopo: ESCOPO } },
      )
      if (eventoIds.length === 0) throw erroCancelamento(alvo.status)

      await this.encerrarSemAgendados(tx, serieId)
      this.eventos.emitirAposCommit('evento.cancelado', {
        atleticaId: autor.atleticaId,
        eventoIds,
        timeId: alvo.timeId,
        autorId: autor.id,
      })
      return { eventoIds, status: 'CANCELADO' }
    })
  }

  /** "Seguintes" = mesma série, depois da alvo, `AGENDADO` e não excluídas (#20 §3 item 9). */
  private seguintes<S extends Prisma.EventoSelect>(
    tx: TransacaoComEscopo,
    serieId: string,
    inicio: Date,
    select: S,
  ) {
    return tx.evento.findMany({
      where: { serieId, inicio: { gt: inicio }, status: 'AGENDADO', ...naoExcluido },
      orderBy: { inicio: 'asc' },
      select,
    })
  }

  /** A nova série começa no dia da alvo e leva todas as ocorrências a partir dela. */
  private async dividir(
    tx: TransacaoComEscopo,
    serie: LinhaSerie,
    inicioAlvo: Date,
    entrada: EditarSeguintes & { horario: string },
    autor: AutorEvento,
  ): Promise<string> {
    const diaAlvo = chaveDiaLocal(inicioAlvo)
    const fimOriginal = dataIso(serie.dataFim)
    const nova = await tx.serieRecorrencia.create({
      data: {
        atleticaId: autor.atleticaId,
        timeId: serie.timeId,
        diasSemana: serie.diasSemana,
        horario: entrada.horario,
        dataInicio: paraData(diaAlvo),
        dataFim: paraData(maior(fimOriginal, diaAlvo)),
        local: entrada.local ?? serie.local,
        observacoes: entrada.observacoes === undefined ? serie.observacoes : entrada.observacoes,
        criadoPorId: autor.id,
      },
      select: { id: true },
    })
    await tx.evento.updateMany({
      where: { serieId: serie.id, inicio: { gte: inicioAlvo } },
      data: { serieId: nova.id },
    })
    const dataFim = maior(dataIso(serie.dataInicio), somarDias(diaAlvo, -1))
    await tx.serieRecorrencia.update({
      where: { id: serie.id },
      data: { dataFim: paraData(dataFim) },
    })
    await this.auditoria.registrar(tx, {
      entidade: 'SerieRecorrencia',
      acao: 'SERIE_DIVIDIDA',
      entidadeId: serie.id,
      dados: {
        antes: { dataFim: fimOriginal },
        depois: { dataFim },
        contexto: { serieOriginalId: serie.id, novaSerieId: nova.id },
      },
    })
    return nova.id
  }

  /** Alvo é a 1ª ocorrência: a série em vigor recebe os valores-modelo enviados. */
  private async atualizarSerie(
    tx: TransacaoComEscopo,
    serie: LinhaSerie,
    entrada: EditarSeguintes,
  ): Promise<void> {
    const depois: LinhaSerie = {
      ...serie,
      horario: entrada.horario ?? serie.horario,
      local: entrada.local ?? serie.local,
      observacoes: entrada.observacoes === undefined ? serie.observacoes : entrada.observacoes,
    }
    const diff = diferenca(serie, depois, CAMPOS_DA_SERIE)
    if (!diff) return

    await tx.serieRecorrencia.update({ where: { id: serie.id }, data: diff.depois })
    await this.auditoria.registrar(tx, {
      entidade: 'SerieRecorrencia',
      acao: 'SERIE_ALTERADA',
      entidadeId: serie.id,
      dados: { ...diff, contexto: { escopo: ESCOPO } },
    })
  }

  private async encerrarSemAgendados(tx: TransacaoComEscopo, serieId: string): Promise<void> {
    const agendados = await tx.evento.count({
      where: { serieId, status: 'AGENDADO', ...naoExcluido },
    })
    if (agendados > 0) return

    const canceladaEm = new Date()
    const { count } = await tx.serieRecorrencia.updateMany({
      where: { id: serieId, canceladaEm: null },
      data: { canceladaEm },
    })
    if (count === 0) return
    await this.auditoria.registrar(tx, {
      entidade: 'SerieRecorrencia',
      acao: 'SERIE_ALTERADA',
      entidadeId: serieId,
      dados: { antes: { canceladaEm: null }, depois: { canceladaEm } },
    })
  }

  /** Um `evento.alterado` por operação, só com as ocorrências de data ou local alterados. */
  private notificarAlteracao(alteracoes: Alteracao[], timeId: string, autor: AutorEvento): void {
    const campos = CAMPOS_NOTIFICADOS.filter((campo) =>
      alteracoes.some(({ diff }) => campo in diff.depois),
    )
    if (campos.length === 0) return
    this.eventos.emitirAposCommit('evento.alterado', {
      atleticaId: autor.atleticaId,
      eventoIds: alteracoes
        .filter(({ diff }) => campos.some((campo) => campo in diff.depois))
        .map(({ id }) => id),
      timeId,
      campos,
      autorId: autor.id,
    })
  }
}
