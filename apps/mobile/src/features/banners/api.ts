import {
  bannerPainelSchema,
  bannersOrdenadosSchema,
  LIMITE_MAXIMO,
  listaBannersPainelSchema,
  listaBannersSchema,
  type BannerAtualizacao,
  type BannerCriacao,
  type BannerDto,
  type BannerPainelDto,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export async function listarBanners(sinal?: AbortSignal): Promise<BannerDto[]> {
  return listaBannersSchema.parse(await api.get('/banners', { sinal })).items
}

/** Uma página só: a reordenação precisa de todos e o volume esperado é < 20. */
export async function listarBannersPainel(sinal?: AbortSignal): Promise<BannerPainelDto[]> {
  const resposta = await api.get('/painel/banners', {
    consulta: { page: 1, limit: LIMITE_MAXIMO },
    sinal,
  })
  return listaBannersPainelSchema.parse(resposta).items
}

export async function buscarBannerPainel(
  id: string,
  sinal?: AbortSignal,
): Promise<BannerPainelDto> {
  return bannerPainelSchema.parse(await api.get(`/painel/banners/${id}`, { sinal }))
}

export async function criarBanner(dados: BannerCriacao): Promise<BannerPainelDto> {
  return bannerPainelSchema.parse(await api.post('/painel/banners', dados))
}

export async function atualizarBanner(
  id: string,
  dados: BannerAtualizacao,
): Promise<BannerPainelDto> {
  return bannerPainelSchema.parse(await api.patch(`/painel/banners/${id}`, dados))
}

export async function ordenarBanners(ids: string[]): Promise<BannerPainelDto[]> {
  return bannersOrdenadosSchema.parse(await api.put('/painel/banners/ordem', { ids })).items
}

export async function excluirBanner(id: string): Promise<void> {
  await api.delete(`/painel/banners/${id}`)
}
