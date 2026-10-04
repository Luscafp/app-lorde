import type { AtleticaPublica } from '@atletica/shared'
import { create } from 'zustand'
import { buscarAtletica, gravarAtleticaNoCache, lerAtleticaDoCache } from './api'

export const atleticaStore = create<{ dados: AtleticaPublica | null }>(() => ({ dados: null }))

async function atualizarDaRede(): Promise<void> {
  const atletica = await buscarAtletica()
  atleticaStore.setState({ dados: atletica })
  await gravarAtleticaNoCache(atletica)
}

/** Aplica o cache na hora; sem cache, espera a rede (limite de 3 s). A rede sempre atualiza o cache. */
export async function carregarAtletica(): Promise<void> {
  const cache = await lerAtleticaDoCache()
  if (cache) atleticaStore.setState({ dados: cache })
  const rede = atualizarDaRede().catch(() => undefined)
  if (!cache) await rede
}
