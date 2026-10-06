import type { Atletica, MembroTime, Prisma, Time, Usuario } from '../../src/generated/prisma/client'
import { prismaTeste } from '../setup/prisma-teste'
import { criarAtletica, type DadosAtletica } from './atletica'
import { criarModalidade } from './modalidades'
import { proximaSequencia } from './sequencia'

export type DadosTime = Partial<Prisma.TimeUncheckedCreateInput> & Pick<Time, 'atleticaId'>

/** Cria um time ativo com nome único; sem `modalidadeId`, cria uma modalidade ativa. */
export async function criarTime(dados: DadosTime): Promise<Time> {
  const modalidadeId = dados.modalidadeId ?? (await criarModalidade()).id
  return prismaTeste.time.create({
    data: { nome: `Time ${proximaSequencia()}`, ...dados, modalidadeId },
  })
}

/** Atlética adversária: `usaAplicativo = false`. */
export function criarAtleticaAdversaria(dados: DadosAtletica = {}): Promise<Atletica> {
  return criarAtletica({ ...dados, usaAplicativo: false })
}

/** Time de uma adversária; sem `atleticaId`, cria a adversária. */
export async function criarTimeAdversario(
  dados: Partial<DadosTime> = {},
): Promise<Time & { atletica: Atletica }> {
  const atletica = dados.atleticaId
    ? await prismaTeste.atletica.findUniqueOrThrow({ where: { id: dados.atleticaId } })
    : await criarAtleticaAdversaria()
  const time = await criarTime({ ...dados, atleticaId: atletica.id })
  return { ...time, atletica }
}

/** Vínculo ativo no elenco; `entradaEm` padrão um minuto atrás. */
export function adicionarMembro(
  time: Pick<Time, 'id' | 'atleticaId'>,
  usuario: Pick<Usuario, 'id'>,
  dados: Partial<Pick<MembroTime, 'entradaEm' | 'saidaEm'>> = {},
): Promise<MembroTime> {
  return prismaTeste.membroTime.create({
    data: {
      atleticaId: time.atleticaId,
      timeId: time.id,
      usuarioId: usuario.id,
      entradaEm: new Date(Date.now() - 60_000),
      ...dados,
    },
  })
}
