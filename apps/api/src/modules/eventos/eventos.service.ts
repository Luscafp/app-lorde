import type {
  CriarEvento,
  EditarEvento,
  EventoCanceladoDto,
  EventoDto,
  StatusEvento,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import type { DetalheErro } from '../../common/erros/erro-negocio'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import type { CampoAlteradoEvento } from '../../infra/eventos/eventos-dominio'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { naoExcluido } from '../../infra/prisma/nao-excluido'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService, type EntradaAuditoria } from '../auditoria/auditoria.service'
import { diferenca } from '../auditoria/diferenca'
import type { UsuarioAutenticado } from '../auth/tipos'
import {
  erroAdversarioEmTreino,
  erroCancelamento,
  erroEventoCancelado,
  erroEventoComDependencias,
  erroEventoComParticipacoes,
  erroEventoFinalizado,
} from './erros'
import { EventosValidator, type TimeDoEvento } from './eventos.validator'
import { auditaveis, buscarEvento, CAMPOS_EVENTO, type LinhaEvento, paraDto } from './linha-evento'

export type AutorEvento = Pick<UsuarioAutenticado, 'id' | 'atleticaId'>

const CAMPOS_EDITAVEIS = ['inicio', 'local', 'observacoes', 'timeId', 'timeAdversarioId'] as const

type CampoEditavel = (typeof CAMPOS_EDITAVEIS)[number]

/** Só estes geram `evento.alterado` (épico #19 §7). */
const CAMPOS_NOTIFICADOS = ['inicio', 'local'] as const satisfies CampoAlteradoEvento[]

const CANCELAVEIS: StatusEvento[] = ['AGENDADO', 'EM_ANDAMENTO']

function descreverParticipacoes(total: number): string {
  return total === 1 ? '1 resposta' : `${total} respostas`
}

/** Escrita de eventos avulsos (épico #19, issue #70). */
@Injectable()
export class EventosService {
  constructor(
    private readonly transacao: TransacaoService,
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventosDominioService,
    private readonly validator: EventosValidator,
  ) {}

  criar(entrada: CriarEvento, autor: AutorEvento): Promise<EventoDto> {
    return this.transacao.executar(async (tx) => {
      const time = await this.validator.validarTime(tx, entrada.timeId, autor.atleticaId)
      const timeAdversarioId = entrada.tipo === 'JOGO' ? entrada.timeAdversarioId : null
      await this.validator.validarAdversario(tx, timeAdversarioId, time, autor.atleticaId)

      const criado = await tx.evento.create({
        data: {
          atleticaId: autor.atleticaId,
          tipo: entrada.tipo,
          timeId: entrada.timeId,
          timeAdversarioId,
          inicio: new Date(entrada.inicio),
          local: entrada.local,
          observacoes: entrada.observacoes ?? null,
          criadoPorId: autor.id,
        },
        select: CAMPOS_EVENTO,
      })
      await this.auditoria.registrar(tx, {
        entidade: 'Evento',
        acao: 'EVENTO_CRIADO',
        entidadeId: criado.id,
        dados: { antes: null, depois: auditaveis(criado) },
      })
      this.eventos.emitirAposCommit('evento.criado', {
        atleticaId: autor.atleticaId,
        eventoId: criado.id,
        timeId: criado.timeId,
        autorId: autor.id,
      })
      return paraDto(criado)
    })
  }

  /** Sem mudança: 200 sem auditoria nem evento de domínio (convenções §7). */
  atualizar(id: string, entrada: EditarEvento, autor: AutorEvento): Promise<EventoDto> {
    return this.transacao.executar(async (tx) => {
      const antes = await buscarEvento(tx, id)
      if (antes.tipo === 'TREINO' && entrada.timeAdversarioId !== undefined) {
        throw erroAdversarioEmTreino()
      }
      if (antes.status === 'CANCELADO') throw erroEventoCancelado()

      const inicio = entrada.inicio === undefined ? antes.inicio : new Date(entrada.inicio)
      const alvo: LinhaEvento = { ...antes, ...entrada, inicio }
      const diff = diferenca(antes, alvo, CAMPOS_EDITAVEIS)
      if (!diff) return paraDto(antes)

      const alterados = Object.keys(diff.depois) as CampoEditavel[]
      if (antes.status === 'FINALIZADO' && alterados.some((campo) => campo !== 'observacoes')) {
        throw erroEventoFinalizado('Evento finalizado só permite editar as observações.')
      }
      await this.validarTimes(tx, antes, alvo, alterados, autor.atleticaId)

      const depois = await tx.evento.update({
        where: { id },
        data: diff.depois,
        select: CAMPOS_EVENTO,
      })
      await this.auditoria.registrar(tx, {
        entidade: 'Evento',
        acao: 'EVENTO_ALTERADO',
        entidadeId: id,
        dados: diff,
      })

      const campos = CAMPOS_NOTIFICADOS.filter((campo) => campo in diff.depois)
      if (campos.length > 0) {
        this.eventos.emitirAposCommit('evento.alterado', {
          atleticaId: autor.atleticaId,
          eventoIds: [id],
          timeId: depois.timeId,
          campos,
          autorId: autor.id,
        })
      }
      return paraDto(depois)
    })
  }

  cancelarPorId(id: string, autor: AutorEvento): Promise<EventoCanceladoDto> {
    return this.transacao.executar(async (tx) => {
      const evento = await buscarEvento(tx, id)
      const eventoIds = await this.cancelar(tx, [id], autor)
      if (eventoIds.length === 0) throw erroCancelamento(evento.status)

      this.eventos.emitirAposCommit('evento.cancelado', {
        atleticaId: autor.atleticaId,
        eventoIds,
        timeId: evento.timeId,
        autorId: autor.id,
      })
      return { eventoIds, status: 'CANCELADO' }
    })
  }

  /** Cancela na transação de quem chama e devolve os ids; `statusAtual` torna a troca condicional. */
  async cancelar(
    tx: TransacaoComEscopo,
    eventoIds: string[],
    usuario: Pick<UsuarioAutenticado, 'id'>,
    statusAtual?: StatusEvento,
  ): Promise<string[]> {
    const status = statusAtual ? CANCELAVEIS.filter((s) => s === statusAtual) : CANCELAVEIS
    const where = { id: { in: eventoIds }, status: { in: status }, ...naoExcluido }
    const antes = await tx.evento.findMany({ where, select: { id: true, status: true } })
    const cancelados = await tx.evento.updateManyAndReturn({
      where,
      data: { status: 'CANCELADO' },
      select: { id: true },
    })

    const statusAntes = new Map(antes.map(({ id, status }) => [id, status]))
    await this.auditoria.registrarVarios(
      tx,
      cancelados.map(({ id }): EntradaAuditoria => ({
        entidade: 'Evento',
        acao: 'EVENTO_CANCELADO',
        entidadeId: id,
        usuarioId: usuario.id,
        dados: { antes: { status: statusAntes.get(id) ?? null }, depois: { status: 'CANCELADO' } },
      })),
    )
    return cancelados.map(({ id }) => id)
  }

  /** Exclusão lógica, só sem participações nem resultado (RN26); não emite evento (§8). */
  async excluir(id: string): Promise<void> {
    await this.transacao.executar(async (tx) => {
      const evento = await buscarEvento(tx, id)
      const dependencias = await this.dependencias(tx, evento)
      if (dependencias.length > 0) throw erroEventoComDependencias(dependencias)

      await tx.evento.update({ where: { id }, data: { excluidoEm: new Date() } })
      await this.auditoria.registrar(tx, {
        entidade: 'Evento',
        acao: 'EVENTO_EXCLUIDO',
        entidadeId: id,
        dados: { antes: auditaveis(evento), depois: null },
      })
    })
  }

  /** Troca de time só sem participações; o adversário é revalidado contra o time resultante. */
  private async validarTimes(
    tx: TransacaoComEscopo,
    antes: LinhaEvento,
    alvo: LinhaEvento,
    alterados: CampoEditavel[],
    atleticaId: string,
  ): Promise<void> {
    const trocaTime = alterados.includes('timeId')
    if (!trocaTime && !alterados.includes('timeAdversarioId')) return
    if (trocaTime && (await this.totalParticipacoes(tx, antes.id)) > 0) {
      throw erroEventoComParticipacoes()
    }

    const time: TimeDoEvento = trocaTime
      ? await this.validator.validarTime(tx, alvo.timeId, atleticaId)
      : { id: antes.timeId, modalidadeId: antes.time.modalidade.id }
    await this.validator.validarAdversario(tx, alvo.timeAdversarioId, time, atleticaId)
  }

  /** Qualquer linha de `Participacao` conta: "Vou", "Não vou" ou presença (épico #19 §4). */
  private totalParticipacoes(tx: TransacaoComEscopo, eventoId: string): Promise<number> {
    return tx.participacao.count({ where: { eventoId } })
  }

  private async dependencias(tx: TransacaoComEscopo, evento: LinhaEvento): Promise<DetalheErro[]> {
    const participacoes = await this.totalParticipacoes(tx, evento.id)
    const detalhes: DetalheErro[] = []
    if (participacoes > 0) {
      detalhes.push({ field: 'participacoes', message: descreverParticipacoes(participacoes) })
    }
    if (evento.resultado !== null) {
      detalhes.push({ field: 'resultado', message: 'Resultado registrado.' })
    }
    return detalhes
  }
}
