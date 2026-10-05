import { StatusEvento, type ElencoDto, type MembroElencoDto, type TimeDto } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService } from '../auditoria/auditoria.service'
import { UploadsService } from '../uploads/uploads.service'
import {
  erroCapitaoForaDoElenco,
  erroMembroNaoEncontrado,
  erroTimeAdversario,
  erroTimeNaoEncontrado,
} from './erros'
import { CAMPOS_TIME, paraDto, VISIVEL_PARA_TODOS } from './linha-time'

export const MotivoSaida = {
  REMOVIDO_PELA_DIRETORIA: 'REMOVIDO_PELA_DIRETORIA',
  SAIU: 'SAIU',
  EXCLUSAO_CONTA: 'EXCLUSAO_CONTA',
} as const

export type MotivoSaida = (typeof MotivoSaida)[keyof typeof MotivoSaida]

const ACAO_DO_MOTIVO = {
  REMOVIDO_PELA_DIRETORIA: 'MEMBRO_REMOVIDO',
  SAIU: 'MEMBRO_SAIU',
  EXCLUSAO_CONTA: 'MEMBRO_REMOVIDO_EXCLUSAO_CONTA',
} as const satisfies Record<MotivoSaida, string>

export interface EncerramentoVinculo {
  timeId: string
  usuarioId: string
  motivo: MotivoSaida
  /** Ator da auditoria. */
  executorId: string
}

export interface VinculoEncerrado {
  capitaniaRemovida: boolean
  participacoesRemovidas: number
}

const NOME_USUARIO_EXCLUIDO = 'Usuário excluído'

const ordemAlfabetica = new Intl.Collator('pt-BR', { sensitivity: 'base' })

function capitaoPrimeiroDepoisNome(a: MembroElencoDto, b: MembroElencoDto): number {
  if (a.capitao !== b.capitao) return a.capitao ? -1 : 1
  return ordemAlfabetica.compare(a.nome, b.nome) || a.usuarioId.localeCompare(b.usuarioId)
}

/** O escopo de `Time` inclui adversárias: visível e sem app = adversário (RN21). */
function garantirProprio<T extends { atletica: { usaAplicativo: boolean } }>(
  time: T | null,
): asserts time is T {
  if (!time) throw erroTimeNaoEncontrado()
  if (!time.atletica.usaAplicativo) throw erroTimeAdversario()
}

/** Elenco e capitão dos times da atlética ativa (épico #16, RN21–RN23). */
@Injectable()
export class ElencoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly uploads: UploadsService,
  ) {}

  /** Elenco atual, capitão primeiro e depois por nome. */
  async listar(timeId: string, incluirInativos: boolean): Promise<ElencoDto> {
    const time = await this.prisma.db.time.findFirst({
      where: incluirInativos ? { id: timeId } : { id: timeId, ...VISIVEL_PARA_TODOS },
      select: { capitaoId: true, atletica: { select: { usaAplicativo: true } } },
    })
    garantirProprio(time)

    const membros = await this.prisma.db.membroTime.findMany({
      where: { timeId, saidaEm: null },
      select: {
        entradaEm: true,
        usuario: { select: { id: true, nome: true, fotoKey: true, excluidoEm: true } },
      },
    })
    const items = membros
      .map(({ entradaEm, usuario }) => {
        const excluido = usuario.excluidoEm !== null
        return {
          usuarioId: usuario.id,
          nome: excluido ? NOME_USUARIO_EXCLUIDO : usuario.nome,
          fotoUrl: excluido ? null : this.uploads.urlPublica(usuario.fotoKey),
          entradaEm: entradaEm.toISOString(),
          capitao: usuario.id === time.capitaoId,
        }
      })
      .sort(capitaoPrimeiroDepoisNome)
    return { items, total: items.length }
  }

  removerMembro(timeId: string, usuarioId: string, executorId: string): Promise<void> {
    return this.prisma.db.$transaction(async (tx) => {
      await this.encerrarVinculo(tx, {
        timeId,
        usuarioId,
        motivo: MotivoSaida.REMOVIDO_PELA_DIRETORIA,
        executorId,
      })
    })
  }

  /**
   * Ponto único de saída do elenco (convenções §11.6), usado também por #12 e #34, sempre na
   * transação de quem chama. Trava o `Time`, preenche `saidaEm`, tira a capitania se for o caso,
   * apaga as confirmações em eventos `AGENDADO` futuros sem presença e audita conforme o `motivo`.
   * Não emite evento de domínio.
   *
   * @throws `404 NOT_FOUND` time inexistente ou de outra atlética que usa o app
   * @throws `422 TIME_ADVERSARIO`
   * @throws `404 MEMBRO_NAO_ENCONTRADO` sem vínculo ativo no time
   */
  async encerrarVinculo(
    tx: TransacaoComEscopo,
    { timeId, usuarioId, motivo, executorId }: EncerramentoVinculo,
  ): Promise<VinculoEncerrado> {
    const capitaoId = await this.travarTimeProprio(tx, timeId)
    const saidaEm = new Date()

    const [membro] = await tx.membroTime.updateManyAndReturn({
      where: { timeId, usuarioId, saidaEm: null },
      data: { saidaEm },
      select: { id: true },
    })
    if (!membro) throw erroMembroNaoEncontrado()

    const capitaniaRemovida = capitaoId === usuarioId
    if (capitaniaRemovida) {
      await tx.time.update({
        where: { id: timeId },
        data: { capitaoId: null },
        select: { id: true },
      })
    }

    const { count: participacoesRemovidas } = await tx.participacao.deleteMany({
      where: {
        usuarioId,
        presente: null,
        evento: { timeId, status: StatusEvento.AGENDADO, inicio: { gt: saidaEm } },
      },
    })

    await this.auditoria.registrar(tx, {
      entidade: 'MembroTime',
      acao: ACAO_DO_MOTIVO[motivo],
      entidadeId: membro.id,
      usuarioId: executorId,
      dados: {
        antes: { saidaEm: null },
        depois: { saidaEm },
        contexto: { timeId, usuarioId, capitaniaRemovida, participacoesRemovidas },
      },
    })
    return { capitaniaRemovida, participacoesRemovidas }
  }

  /** `null` remove o capitão; sem mudança, responde sem auditar (convenções §7). */
  definirCapitao(timeId: string, usuarioId: string | null, atleticaId: string): Promise<TimeDto> {
    return this.prisma.db.$transaction(async (tx) => {
      const anterior = await this.travarTimeProprio(tx, timeId)
      if (usuarioId !== anterior) {
        if (usuarioId !== null && !(await this.ehMembroAtivo(tx, timeId, usuarioId))) {
          throw erroCapitaoForaDoElenco()
        }
        await tx.time.update({ where: { id: timeId }, data: { capitaoId: usuarioId } })
        await this.auditoria.registrar(tx, {
          entidade: 'Time',
          acao: usuarioId ? 'CAPITAO_DEFINIDO' : 'CAPITAO_REMOVIDO',
          entidadeId: timeId,
          dados: { antes: { capitaoId: anterior }, depois: { capitaoId: usuarioId } },
        })
      }
      const time = await tx.time.findUniqueOrThrow({ where: { id: timeId }, select: CAMPOS_TIME })
      return paraDto(time, atleticaId)
    })
  }

  /** `FOR UPDATE` serializa remoção e troca de capitão no mesmo time; devolve o `capitaoId`. */
  private async travarTimeProprio(tx: TransacaoComEscopo, timeId: string): Promise<string | null> {
    const time = await tx.time.findUnique({
      where: { id: timeId },
      select: { atletica: { select: { usaAplicativo: true } } },
    })
    garantirProprio(time)

    const [travado] = await tx.$queryRaw<{ capitaoId: string | null }[]>`
      SELECT "capitaoId" FROM "Time" WHERE "id" = ${timeId}::uuid FOR UPDATE`
    if (!travado) throw erroTimeNaoEncontrado()
    return travado.capitaoId
  }

  private async ehMembroAtivo(
    tx: TransacaoComEscopo,
    timeId: string,
    usuarioId: string,
  ): Promise<boolean> {
    return (await tx.membroTime.count({ where: { timeId, usuarioId, saidaEm: null } })) > 0
  }
}
