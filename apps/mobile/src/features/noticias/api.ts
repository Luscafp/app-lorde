import {
  listaNoticiasSchema,
  noticiaDetalheSchema,
  type ListaNoticias,
  type NoticiaDetalheDto,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export const LIMITE_PAGINA = 20

export async function listarNoticias(
  page: number,
  limit: number,
  sinal?: AbortSignal,
): Promise<ListaNoticias> {
  return listaNoticiasSchema.parse(await api.get('/noticias', { consulta: { page, limit }, sinal }))
}

export async function buscarNoticia(id: string, sinal?: AbortSignal): Promise<NoticiaDetalheDto> {
  return noticiaDetalheSchema.parse(await api.get(`/noticias/${id}`, { sinal }))
}
