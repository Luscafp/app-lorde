import {
  listaNoticiasPainelSchema,
  noticiaPainelDetalheSchema,
  type FiltrosNoticiasPainel,
  type ListaNoticiasPainel,
  type NoticiaAtualizacao,
  type NoticiaCriacao,
  type NoticiaPainelDetalheDto,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export const LIMITE_PAGINA = 20

export async function listarNoticiasPainel(
  filtros: FiltrosNoticiasPainel,
  page: number,
  sinal?: AbortSignal,
): Promise<ListaNoticiasPainel> {
  const resposta = await api.get('/painel/noticias', {
    consulta: { ...filtros, page, limit: LIMITE_PAGINA },
    sinal,
  })
  return listaNoticiasPainelSchema.parse(resposta)
}

export async function buscarNoticiaPainel(
  id: string,
  sinal?: AbortSignal,
): Promise<NoticiaPainelDetalheDto> {
  return noticiaPainelDetalheSchema.parse(await api.get(`/painel/noticias/${id}`, { sinal }))
}

export async function criarNoticia(dados: NoticiaCriacao): Promise<NoticiaPainelDetalheDto> {
  return noticiaPainelDetalheSchema.parse(await api.post('/painel/noticias', dados))
}

export async function atualizarNoticia(
  id: string,
  dados: NoticiaAtualizacao,
): Promise<NoticiaPainelDetalheDto> {
  return noticiaPainelDetalheSchema.parse(await api.patch(`/painel/noticias/${id}`, dados))
}

export async function publicarNoticia(id: string): Promise<NoticiaPainelDetalheDto> {
  return noticiaPainelDetalheSchema.parse(await api.post(`/painel/noticias/${id}/publicar`))
}

export async function despublicarNoticia(id: string): Promise<NoticiaPainelDetalheDto> {
  return noticiaPainelDetalheSchema.parse(await api.post(`/painel/noticias/${id}/despublicar`))
}

export async function excluirNoticia(id: string): Promise<void> {
  await api.delete(`/painel/noticias/${id}`)
}
