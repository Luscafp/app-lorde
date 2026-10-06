import type { AtleticaPublica } from '@atletica/shared'
import { queryOptions } from '@tanstack/react-query'
import { chaves } from '@/infra/query/chaves'
import { queryClient } from '@/infra/query/query-client'
import {
  buscarAtletica,
  gravarAtleticaNoCache,
  lerAtleticaDoCache,
  type AtleticaEmCache,
} from './api'

export const ESPERA_MAXIMA_ATLETICA_MS = 3000

let atleticaLidaNaSplash: AtleticaEmCache | undefined

export const consultaAtletica = queryOptions({
  queryKey: chaves.atletica(),
  queryFn: async ({ signal }) => {
    const atletica = await buscarAtletica(signal)
    await gravarAtleticaNoCache(atletica).catch(() => undefined)
    return atletica
  },
})

export function atleticaLidaPorCarregarAtletica(): AtleticaPublica | undefined {
  return atleticaLidaNaSplash?.atletica
}

export function atleticaLidaSalvaEm(): number {
  return atleticaLidaNaSplash?.salvaEm ?? 0
}

/** Com cache, libera a splash na hora; sem cache, espera a rede por até 3 s, sem repetir. */
export async function carregarAtletica(): Promise<void> {
  atleticaLidaNaSplash = (await lerAtleticaDoCache()) ?? undefined
  if (atleticaLidaNaSplash) return
  let limite: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    queryClient.prefetchQuery({ ...consultaAtletica, retry: false }),
    new Promise((resolver) => (limite = setTimeout(resolver, ESPERA_MAXIMA_ATLETICA_MS))),
  ])
  clearTimeout(limite)
}
