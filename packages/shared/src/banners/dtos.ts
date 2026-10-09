import { z } from 'zod'
import { respostaPaginadaSchema } from '../utils/paginacao'

/** Item de `GET /banners`: só ativos, na ordem do carrossel. */
export const bannerSchema = z
  .object({
    id: z.uuid(),
    titulo: z.string(),
    imagemUrl: z.string(),
    link: z.string().nullable(),
  })
  .strict()

/** Sem paginação: no máximo `LIMITE_BANNERS_ATIVOS` (convenções §4.4). */
export const listaBannersSchema = z.object({ items: z.array(bannerSchema) }).strict()

/** Item de `GET /painel/banners` e respostas das escritas. */
export const bannerPainelSchema = bannerSchema
  .extend({
    ordem: z.number().int(),
    ativo: z.boolean(),
    criadoEm: z.iso.datetime(),
    atualizadoEm: z.iso.datetime(),
  })
  .strict()

export const listaBannersPainelSchema = respostaPaginadaSchema(bannerPainelSchema)

/** `PUT /painel/banners/ordem`: todos os banners, na nova ordem. */
export const bannersOrdenadosSchema = z.object({ items: z.array(bannerPainelSchema) }).strict()

export type BannerDto = z.infer<typeof bannerSchema>
export type ListaBanners = z.infer<typeof listaBannersSchema>
export type BannerPainelDto = z.infer<typeof bannerPainelSchema>
export type ListaBannersPainel = z.infer<typeof listaBannersPainelSchema>
export type BannersOrdenados = z.infer<typeof bannersOrdenadosSchema>
