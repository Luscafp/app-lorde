import { randomUUID } from 'node:crypto'
import type { Banner, Prisma } from '../../src/generated/prisma/client'
import { prismaTeste } from '../setup/prisma-teste'
import { proximaSequencia } from './sequencia'

export type DadosBanner = Pick<Prisma.BannerUncheckedCreateInput, 'atleticaId'> &
  Partial<Prisma.BannerUncheckedCreateInput>

/** Chave de imagem no formato do presign (finalidade `BANNER`, convenções §11.5). */
export function chaveDeBanner(atleticaId: string, usuarioId: string, ext = 'webp'): string {
  return `atleticas/${atleticaId}/banners/${usuarioId}/${randomUUID()}.${ext}`
}

/** Cria um banner ativo, sem link, com título único e `ordem` = sequência. */
export function criarBanner(dados: DadosBanner): Promise<Banner> {
  const n = proximaSequencia()
  return prismaTeste.banner.create({
    data: {
      titulo: `Banner ${n}`,
      imagemKey: chaveDeBanner(dados.atleticaId, randomUUID()),
      ordem: n,
      ...dados,
    },
  })
}
