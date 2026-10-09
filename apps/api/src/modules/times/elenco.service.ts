import {
  StatusEvento,
  type AcaoDaEntidade,
  type ElencoDto,
  type MembroElencoDto,
  type SaidaTimeDto,
  type TimeDto,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService } from '../auditoria/auditoria.service'
import { UploadsService } from '../uploads/uploads.service'
import {
  erroCapitaoForaDoElenco,
  erroMembroNaoEncontrado,
  erroNaoEMembro,
  erroTimeAdversario,
  erroTimeNaoEncontrado,
  MEMBRO_NAO_ENCONTRADO,
} from './erros'
import { CAMPOS_TIME, paraDto, VISIVEL_PARA_TODOS } from './linha-time'
import { CAMPOS_MEMBRO, ELENCO_ATUAL, identidadeMembro } from './membro'

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
} as const satisfies Record<MotivoSaida, AcaoDaEntidade<'MembroTime'>>

export interface EncerramentoVinculo {
  timeId: string
  usuarioId: string
  motivo: MotivoSaida
  /** Ator da auditoria. */
  executorId: string
}

export interface VinculoEncerrado {
  saidaEm: Date
  capitaniaRemovida: boolean
  participacoesRemovidas: number
}

const ordemAlfabetica = new Intl.Collator('pt-BR', { sensitivity: 'base' })

function vinculoAtivo(timeId: string, usuarioId: string) {
  return { timeId, usuarioId, ...ELENCO_ATUAL }
}

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
      where: { timeId, ...ELENCO_ATUAL },
      select: { entradaEm: true, usuario: { select: CAMPOS_MEMBRO } },
    })
    const items = membros
      .map(({ entradaEm, usuario }) => ({
        usuarioId: usuario.id,
        ...identidadeMembro(usuario, this.uploads),
        entradaEm: entradaEm.toISOString(),
        capitao: usuario.id === time.capitaoId,
      }))
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

  /** O próprio usuário sai do time (RF23); sem vínculo ativo → `409 NAO_E_MEMBRO`. */
  async sair(timeId: string, usuarioId: string): Promise<SaidaTimeDto> {
    try {
      const { saidaEm, ...resultado } = await this.prisma.db.$transaction((tx) =>
        this.encerrarVinculo(tx, {
          timeId,
          usuarioId,
          motivo: MotivoSaida.SAIU,
          executorId: usuarioId,
        }),
      )
      return { timeId, saidaEm: saidaEm.toISOString(), ...resultado }
    } catch (erro) {
      if (erro instanceof ErroNegocio && erro.code === MEMBRO_NAO_ENCONTRADO) {
        throw erroNaoEMembro()
      }
      throw erro
    }
  }

  /**
   * Ponto único de saída do elenco (convenções §11.6, #12, #34), na transação de quem chama.
   * Passos e auditoria: README da API, seção "Elenco e capitão". Não emite evento de domínio.
   *
   * @throws `404 NOT_FOUND` time inexistente ou de outra atlética que usa o app
   * @throws `422 TIME_ADVERSARIO`
   * @throws `404 MEMBRO_NAO_ENCONTRADO` sem vínculo ativo no time
   */
  async encerrarVinculo(
    tx: TransacaoComEscopo,
    { timeId, usuarioId, motivo, executorId }: EncerramentoVinculo,
  ): Promise<VinculoEncerrado> {
    const { capitaoId, agora: saidaEm } = await this.travarTimeProprio(tx, timeId)

    const [membro] = await tx.membroTime.updateManyAndReturn({
      where: vinculoAtivo(timeId, usuarioId),
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
    return { saidaEm, capitaniaRemovida, participacoesRemovidas }
  }

  /** `null` remove o capitão; sem mudança, responde sem auditar (convenções §7). */
  definirCapitao(timeId: string, usuarioId: string | null, atleticaId: string): Promise<TimeDto> {
    return this.prisma.db.$transaction(async (tx) => {
      const { capitaoId: anterior } = await this.travarTimeProprio(tx, timeId)
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

  /** `FOR UPDATE` serializa remoção e troca de capitão no mesmo time; `agora` é o `now()` do banco. */
  private async travarTimeProprio(
    tx: TransacaoComEscopo,
    timeId: string,
  ): Promise<{ capitaoId: string | null; agora: Date }> {
    const time = await tx.time.findUnique({
      where: { id: timeId },
      select: { atletica: { select: { usaAplicativo: true } } },
    })
    garantirProprio(time)

    const [travado] = await tx.$queryRaw<{ capitaoId: string | null; agora: Date }[]>`
      SELECT "capitaoId", now() AS "agora" FROM "Time" WHERE "id" = ${timeId}::uuid FOR UPDATE`
    if (!travado) throw erroTimeNaoEncontrado()
    return travado
  }

  private async ehMembroAtivo(
    tx: TransacaoComEscopo,
    timeId: string,
    usuarioId: string,
  ): Promise<boolean> {
    return (await tx.membroTime.count({ where: vinculoAtivo(timeId, usuarioId) })) > 0
  }
}
