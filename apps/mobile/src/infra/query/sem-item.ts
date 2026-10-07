import type { InfiniteData } from '@tanstack/react-query'

type Pagina = { items: { id: string }[] }

export type ListaEmCache<P extends Pagina> = P | InfiniteData<P>

/** O `total` fica como veio do servidor: a paginação não pode parar antes da hora. */
export function semItem<P extends Pagina>(pagina: P, id: string): P {
  const items = pagina.items.filter((item) => item.id !== id)
  if (items.length === pagina.items.length) return pagina
  return { ...pagina, items }
}

export function semItemNaLista<P extends Pagina>(
  dados: ListaEmCache<P>,
  id: string,
): ListaEmCache<P> {
  if ('pages' in dados) {
    return { ...dados, pages: dados.pages.map((pagina) => semItem(pagina, id)) }
  }
  return semItem(dados, id)
}
