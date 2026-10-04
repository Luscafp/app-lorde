import type { AtleticaPublica } from '@atletica/shared'
import { useMemo } from 'react'
import { create } from 'zustand'
import { buscarAtletica, gravarAtleticaNoCache, lerAtleticaDoCache } from './api'

export const COR_NEUTRA = '#6B7280'
export const NOME_GENERICO = 'Atlética'

export type Atletica = Omit<AtleticaPublica, 'id' | 'corPrimaria' | 'corSecundaria'> & {
  id: string | null
  corPrimaria: string
  corSecundaria: string
}

export const atleticaStore = create<{ dados: AtleticaPublica | null }>(() => ({ dados: null }))

export function resolverAtletica(dados: AtleticaPublica | null): Atletica {
  return {
    id: dados?.id ?? null,
    nome: dados?.nome ?? NOME_GENERICO,
    sigla: dados?.sigla ?? null,
    curso: dados?.curso ?? null,
    logoUrl: dados?.logoUrl ?? null,
    corPrimaria: dados?.corPrimaria ?? COR_NEUTRA,
    corSecundaria: dados?.corSecundaria ?? COR_NEUTRA,
    contatoEmail: dados?.contatoEmail ?? null,
    contatoInstagram: dados?.contatoInstagram ?? null,
    contatoWhatsapp: dados?.contatoWhatsapp ?? null,
  }
}

/** Marca da atlética, com fallback neutro enquanto não há cache nem resposta da API. */
export function useAtletica(): Atletica {
  const dados = atleticaStore((estado) => estado.dados)
  return useMemo(() => resolverAtletica(dados), [dados])
}

async function atualizarDaRede(): Promise<void> {
  try {
    const atletica = await buscarAtletica()
    atleticaStore.setState({ dados: atletica })
    await gravarAtleticaNoCache(atletica)
  } catch {
    // Sem rede: fica o cache ou o fallback neutro.
  }
}

/** Aplica o cache na hora; sem cache, espera a rede (limite de 3 s). A rede sempre atualiza o cache. */
export async function carregarAtletica(): Promise<void> {
  const cache = await lerAtleticaDoCache()
  if (cache) atleticaStore.setState({ dados: cache })
  const rede = atualizarDaRede()
  if (!cache) await rede
}
