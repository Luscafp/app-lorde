import type { BannerAtualizacao, BannerCriacao, BannerPainelDto } from '@atletica/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { persistida } from '@/infra/query/persistencia'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import {
  atualizarBanner,
  buscarBannerPainel,
  criarBanner,
  excluirBanner,
  listarBanners,
  listarBannersPainel,
  ordenarBanners,
} from './api'

const CINCO_MINUTOS_MS = 5 * 60_000
const PREFIXO_PAINEL = chaves.painel.banners.lista().slice(0, 2)

export const ERROS_DO_FORMULARIO = [
  'VALIDATION_ERROR',
  'UPLOAD_INVALIDO',
  'UPLOAD_NAO_ENCONTRADO',
  'LIMITE_BANNERS_ATIVOS',
]

/** Carrossel da Home: persistido para o modo offline (#29). */
export function useBanners() {
  return useQuery({
    queryKey: chaves.banners(),
    queryFn: ({ signal }) => listarBanners(signal),
    staleTime: CINCO_MINUTOS_MS,
    ...persistida,
  })
}

export function useBannersPainel() {
  return useQuery({
    queryKey: chaves.painel.banners.lista(),
    queryFn: ({ signal }) => listarBannersPainel(signal),
  })
}

export function useBannerPainel(id: string) {
  return useQuery({
    queryKey: chaves.painel.banners.detalhe(id),
    queryFn: ({ signal }) => buscarBannerPainel(id, signal),
  })
}

/** O Painel e a Home mostram os mesmos banners. */
function useInvalidar() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: PREFIXO_PAINEL }),
      cliente.invalidateQueries({ queryKey: chaves.banners() }),
    ])
}

export function useCriarBanner() {
  const invalidar = useInvalidar()
  return useAcaoOnline<BannerPainelDto, ApiErro, BannerCriacao>({
    mutationFn: (dados) => criarBanner(dados),
    meta: { errosNaTela: ERROS_DO_FORMULARIO },
    onSuccess: invalidar,
  })
}

type Atualizacao = { id: string; dados: BannerAtualizacao }

export function useAtualizarBanner(errosNaTela: string[] = ERROS_DO_FORMULARIO) {
  const invalidar = useInvalidar()
  return useAcaoOnline<BannerPainelDto, ApiErro, Atualizacao>({
    mutationFn: ({ id, dados }) => atualizarBanner(id, dados),
    meta: { errosNaTela },
    onSuccess: invalidar,
  })
}

export function useOrdenarBanners() {
  const invalidar = useInvalidar()
  return useAcaoOnline<BannerPainelDto[], ApiErro, string[]>({
    mutationFn: (ids) => ordenarBanners(ids),
    onSuccess: invalidar,
  })
}

export function useExcluirBanner() {
  const cliente = useQueryClient()
  const invalidar = useInvalidar()
  return useAcaoOnline<void, ApiErro, string>({
    mutationFn: (id) => excluirBanner(id),
    onSuccess: (_resultado, id) => {
      cliente.removeQueries({ queryKey: chaves.painel.banners.detalhe(id), exact: true })
      return invalidar()
    },
  })
}
