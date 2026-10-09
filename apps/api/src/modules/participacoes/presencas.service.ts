import {
  aceitaPresenca,
  respostaPresenca,
  type ItemPresenca,
  type ListaPresencaDto,
  type StatusEvento,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import { naoExcluido } from '../../infra/prisma/nao-excluido'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService } from '../auditoria/auditoria.service'
import type { UsuarioNaAtletica } from '../auth/tipos'
import { erroEventoNaoEncontrado } from '../eventos/erros'
import { CAMPOS_MEMBRO, identidadeMembro } from '../times/membro'
import { UploadsService } from '../uploads/uploads.service'
import { erroAtletaForaDoElenco, erroStatusSemPresenca } from './erros'

type LeitorChamada = Pick<TransacaoComEscopo, 'membroTime' | 'participacao'>

interface EventoDaChamada {
  id: string
  atleticaId: string
  status: StatusEvento
  inicio: Date
  timeId: string
}

const CAMPOS_EVENTO = {
  id: true,
  atleticaId: true,
  status: true,
  inicio: true,
  timeId: true,
} as const satisfies Prisma.EventoSelect

const CAMPOS_PARTICIPACAO = {
  usuarioId: true,
  confirmado: true,
  presente: true,
  presencaRegistradaEm: true,
} as const satisfies Prisma.ParticipacaoSelect

type Membro = Prisma.UsuarioGetPayload<{ select: typeof CAMPOS_MEMBRO }>
type LinhaParticipacao = Prisma.ParticipacaoGetPayload<{ select: typeof CAMPOS_PARTICIPACAO }>

interface Chamada {
  evento: EventoDaChamada
  membros: Map<string, Membro>
  participacoes: Map<string, LinhaParticipacao>
}

/** Vínculo que cobria o início do evento (épico #35 §3.1 item 2). */
function elencoNoInicio({ timeId, inicio }: EventoDaChamada): Prisma.MembroTimeWhereInput {
  return {
    timeId,
    entradaEm: { lte: inicio },
    OR: [{ saidaEm: null }, { saidaEm: { gt: inicio } }],
  }
}

function presentesSalvos({ membros, participacoes }: Chamada): string[] {
  return [...participacoes.values()]
    .filter(({ usuarioId, presente }) => presente === true && membros.has(usuarioId))
    .map(({ usuarioId }) => usuarioId)
    .sort()
}

function chamadaCompleta({ membros, participacoes }: Chamada): boolean {
  return [...membros.keys()].every((id) => (participacoes.get(id)?.presente ?? null) !== null)
}

function mesmaLista(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

function ultimoRegistro(participacoes: Iterable<LinhaParticipacao>): Date | null {
  let ultimo: Date | null = null
  for (const { presencaRegistradaEm: em } of participacoes) {
    if (em && (!ultimo || em > ultimo)) ultimo = em
  }
  return ultimo
}

/** Registro e correção da presença pela diretoria (RF33, RN31, UC18); sem evento de domínio. */
@Injectable()
export class PresencasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transacao: TransacaoService,
    private readonly auditoria: AuditoriaService,
    private readonly uploads: UploadsService,
  ) {}

  /** Sem chamada registrada, `presente` vem pré-preenchido com quem confirmou (RN31). */
  async listar(eventoId: string): Promise<ListaPresencaDto> {
    const evento = await this.prisma.db.evento.findFirst({
      where: { id: eventoId, ...naoExcluido },
      select: CAMPOS_EVENTO,
    })
    if (!evento) throw erroEventoNaoEncontrado()
    return this.paraDto(await this.lerChamada(this.prisma.db, evento))
  }

  /** Substitui a chamada inteira; a mesma lista já registrada é no-op (sem auditoria). */
  registrar(
    eventoId: string,
    presentes: string[],
    autor: UsuarioNaAtletica,
  ): Promise<ListaPresencaDto> {
    return this.transacao.executar(async (tx) => {
      const evento = await this.bloquear(tx, eventoId, autor.atleticaId)
      if (!aceitaPresenca(evento.status)) throw erroStatusSemPresenca()

      const chamada = await this.lerChamada(tx, evento)
      const foraDoElenco = presentes.filter((id) => !chamada.membros.has(id))
      if (foraDoElenco.length > 0) throw erroAtletaForaDoElenco(foraDoElenco)

      const antes = presentesSalvos(chamada)
      const depois = [...presentes].sort()
      if (chamadaCompleta(chamada) && mesmaLista(antes, depois)) return this.paraDto(chamada)

      await this.gravar(tx, chamada, new Set(presentes), autor.id)
      await this.auditoria.registrar(tx, {
        entidade: 'Participacao',
        acao: 'PRESENCAS_REGISTRADAS',
        entidadeId: eventoId,
        dados: { antes: { presentes: antes }, depois: { presentes: depois } },
      })
      return this.paraDto({ ...chamada, participacoes: await this.participacoes(tx, eventoId) })
    })
  }

  /** O lock serializa chamadas concorrentes e a troca de status do mesmo evento. */
  private async bloquear(
    tx: TransacaoComEscopo,
    id: string,
    atleticaId: string,
  ): Promise<EventoDaChamada> {
    const [evento] = await tx.$queryRaw<EventoDaChamada[]>`
      SELECT "id", "atleticaId", "status", "inicio", "timeId" FROM "Evento"
      WHERE "id" = ${id}::uuid AND "atleticaId" = ${atleticaId}::uuid AND "excluidoEm" IS NULL
      FOR UPDATE`
    if (!evento) throw erroEventoNaoEncontrado()
    return evento
  }

  private async lerChamada(db: LeitorChamada, evento: EventoDaChamada): Promise<Chamada> {
    const [vinculos, participacoes] = await Promise.all([
      db.membroTime.findMany({
        where: elencoNoInicio(evento),
        select: { usuario: { select: CAMPOS_MEMBRO } },
      }),
      this.participacoes(db, evento.id),
    ])
    const membros = new Map(vinculos.map(({ usuario }) => [usuario.id, usuario]))
    return { evento, membros, participacoes }
  }

  private async participacoes(
    db: LeitorChamada,
    eventoId: string,
  ): Promise<Map<string, LinhaParticipacao>> {
    const linhas = await db.participacao.findMany({
      where: { eventoId },
      select: CAMPOS_PARTICIPACAO,
    })
    return new Map(linhas.map((linha) => [linha.usuarioId, linha]))
  }

  /** Não toca em `confirmado`/`respondidoEm`; `skipDuplicates` cobre a linha criada em paralelo. */
  private async gravar(
    tx: TransacaoComEscopo,
    { evento, membros, participacoes }: Chamada,
    presentes: Set<string>,
    autorId: string,
  ): Promise<void> {
    const registro = { presencaRegistradaEm: new Date(), presencaRegistradaPorId: autorId }
    const elenco = [...membros.keys()]
    const novos = elenco.filter((id) => !participacoes.has(id))
    if (novos.length > 0) {
      await tx.participacao.createMany({
        data: novos.map((usuarioId) => ({
          atleticaId: evento.atleticaId,
          eventoId: evento.id,
          usuarioId,
          presente: presentes.has(usuarioId),
          ...registro,
        })),
        skipDuplicates: true,
      })
    }
    const marcar = async (usuarioIds: string[], presente: boolean) => {
      if (usuarioIds.length === 0) return
      await tx.participacao.updateMany({
        where: { eventoId: evento.id, usuarioId: { in: usuarioIds } },
        data: { presente, ...registro },
      })
    }
    await marcar(
      elenco.filter((id) => presentes.has(id)),
      true,
    )
    await marcar(
      elenco.filter((id) => !presentes.has(id)),
      false,
    )
  }

  private paraDto({ evento, membros, participacoes }: Chamada): ListaPresencaDto {
    const registradaEm = ultimoRegistro(participacoes.values())
    const registrada = registradaEm !== null
    const itens = [...membros.values()].map((usuario): ItemPresenca => {
      const participacao = participacoes.get(usuario.id)
      return {
        usuarioId: usuario.id,
        ...identidadeMembro(usuario, this.uploads),
        resposta: respostaPresenca(participacao?.confirmado),
        presente: registrada ? participacao?.presente === true : participacao?.confirmado === true,
      }
    })
    itens.sort(
      (a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.usuarioId.localeCompare(b.usuarioId),
    )
    return {
      eventoId: evento.id,
      status: evento.status,
      registrada,
      registradaEm: registradaEm?.toISOString() ?? null,
      itens,
    }
  }
}
