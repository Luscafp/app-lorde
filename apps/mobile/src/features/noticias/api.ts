import {
  listaNoticiasSchema,
  noticiaDetalheSchema,
  type ListaNoticias,
  type ListarNoticiasQuery,
  type NoticiaDetalheDto,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export const LIMITE_PAGINA = 20

export async function listarNoticias(
  consulta: ListarNoticiasQuery,
  sinal?: AbortSignal,
): Promise<ListaNoticias> {
  return listaNoticiasSchema.parse(await api.get('/noticias', { consulta, sinal }))
}

export async function buscarNoticia(id: string, sinal?: AbortSignal): Promise<NoticiaDetalheDto> {
  return noticiaDetalheSchema.parse(await api.get(`/noticias/${id}`, { sinal }))
}
