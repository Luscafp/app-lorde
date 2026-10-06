import type { Evento, Prisma } from '../../src/generated/prisma/client'
import { prismaTeste } from '../setup/prisma-teste'
import { proximaSequencia } from './sequencia'
import { criarTime, criarTimeAdversario } from './times'
import { criarUsuario } from './usuario'

const DIA_MS = 24 * 60 * 60 * 1000

export interface DadosParticipacao {
  usuarioId: string
  /** `true` = "Vou", `false` = "Não vou", `null`/ausente = sem resposta. */
  confirmado?: boolean | null
  presente?: boolean | null
}

export type DadosEvento = Pick<Prisma.EventoUncheckedCreateInput, 'atleticaId'> &
  Partial<Prisma.EventoUncheckedCreateInput> & {
    /** Linhas de `Participacao` criadas junto com o evento. */
    participantes?: DadosParticipacao[]
  }

async function modalidadeDoTime(timeId: string): Promise<string> {
  const time = await prismaTeste.time.findUniqueOrThrow({ where: { id: timeId } })
  return time.modalidadeId
}

/**
 * Cria um evento `AGENDADO` amanhã. Sem `tipo`, cria um TREINO. O que faltar é criado: time da
 * atlética, adversário da mesma modalidade (JOGO) e autor DIRETOR. Valores informados, inclusive
 * `null`, vão direto para o banco (útil para testar CHECKs).
 */
export async function criarEvento(dados: DadosEvento): Promise<Evento> {
  const { participantes = [], ...evento } = dados
  const { atleticaId } = evento
  const tipo = evento.tipo ?? 'TREINO'
  const timeId = evento.timeId ?? (await criarTime({ atleticaId })).id
  const timeAdversarioId =
    evento.timeAdversarioId !== undefined
      ? evento.timeAdversarioId
      : tipo === 'JOGO'
        ? (await criarTimeAdversario({ modalidadeId: await modalidadeDoTime(timeId) })).id
        : null
  const criadoPorId =
    evento.criadoPorId ?? (await criarUsuario({ papel: 'DIRETOR', atleticaId })).id

  const criado = await prismaTeste.evento.create({
    data: {
      inicio: new Date(Date.now() + DIA_MS),
      local: `Ginásio ${proximaSequencia()}`,
      ...evento,
      tipo,
      timeId,
      timeAdversarioId,
      criadoPorId,
    },
  })
  await criarParticipacoes(criado, participantes)
  return criado
}

export function criarJogo(dados: DadosEvento): Promise<Evento> {
  return criarEvento({ ...dados, tipo: 'JOGO' })
}

export function criarTreino(dados: DadosEvento): Promise<Evento> {
  return criarEvento({ ...dados, tipo: 'TREINO' })
}

/** Resposta e presença com as datas exigidas pelos CHECKs `participacao_*_coerente`. */
export async function criarParticipacoes(
  evento: Pick<Evento, 'id' | 'atleticaId'>,
  participacoes: DadosParticipacao[],
): Promise<void> {
  const agora = new Date()
  await prismaTeste.participacao.createMany({
    data: participacoes.map(({ usuarioId, confirmado = null, presente = null }) => ({
      atleticaId: evento.atleticaId,
      eventoId: evento.id,
      usuarioId,
      confirmado,
      respondidoEm: confirmado === null ? null : agora,
      presente,
      presencaRegistradaEm: presente === null ? null : agora,
    })),
  })
}
