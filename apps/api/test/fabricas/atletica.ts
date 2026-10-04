import type { Atletica, Prisma } from '../../src/generated/prisma/client'
import { limparBanco } from '../setup/limpar-banco'
import { prismaTeste } from '../setup/prisma-teste'
import { proximaSequencia } from './sequencia'

export type DadosAtletica = Partial<Prisma.AtleticaUncheckedCreateInput>

/**
 * Cria uma atlética. Por padrão usa o aplicativo, com `slug`, `sigla` e cores válidas
 * (`CHECK atletica_dados_app`). `criarAtletica({ usaAplicativo: false })` cria uma adversária,
 * só com o nome. Qualquer campo pode ser sobrescrito.
 */
export async function criarAtletica(dados: DadosAtletica = {}): Promise<Atletica> {
  const n = proximaSequencia()
  const usaAplicativo = dados.usaAplicativo ?? true
  const padraoApp = usaAplicativo
    ? { slug: `atletica-${n}`, sigla: `AT${n}`, corPrimaria: '#1A2B3C', corSecundaria: '#FFFFFF' }
    : {}

  return prismaTeste.atletica.create({
    data: { nome: `Atlética ${n}`, ...padraoApp, ...dados, usaAplicativo },
  })
}

/** Esvazia o banco e deixa só a atlética padrão, exigida para a API subir (#50). */
export async function prepararAtleticaPadrao(dados: DadosAtletica = {}): Promise<Atletica> {
  await limparBanco()
  return criarAtletica(dados)
}
