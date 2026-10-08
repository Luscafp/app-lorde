import { LIMITE_MAXIMO, listaTagsSchema, type FiltrosTags, type ListaTags } from '@atletica/shared'
import { api } from '@/infra/api/cliente'

/** Uma página basta: os chips e as sugestões mostram no máximo 50 tags. */
export async function listarTags(filtros: FiltrosTags, sinal?: AbortSignal): Promise<ListaTags> {
  const consulta = { ...filtros, page: 1, limit: LIMITE_MAXIMO }
  return listaTagsSchema.parse(await api.get('/tags', { consulta, sinal }))
}
