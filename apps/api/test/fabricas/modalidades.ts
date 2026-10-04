import type { Modalidade, Prisma } from '../../src/generated/prisma/client'
import { prismaTeste } from '../setup/prisma-teste'
import { proximaSequencia } from './sequencia'

/** Cria uma modalidade ativa com nome único e ícone do catálogo. */
export function criarModalidade(
  dados: Partial<Prisma.ModalidadeCreateInput> = {},
): Promise<Modalidade> {
  return prismaTeste.modalidade.create({
    data: { nome: `Modalidade ${proximaSequencia()}`, icone: 'trophy', ...dados },
  })
}
