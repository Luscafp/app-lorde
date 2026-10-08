import { z } from 'zod'
import { paginacaoQuerySchema } from '../utils/paginacao'

export const TITULO_BANNER_MIN = 3
export const TITULO_BANNER_MAX = 80
/** Limite da coluna `Banner.link` (`VarChar(500)`). */
export const LINK_BANNER_MAX = 500
export const CHAVE_IMAGEM_BANNER_MAX = 300
export const LIMITE_BANNERS_ATIVOS = 10
export const ORDEM_BANNERS_MAX = 100

export const MENSAGEM_LINK_HTTPS = 'O link deve começar com https://'
export const MENSAGEM_IMAGEM_BANNER = 'Escolha a imagem do banner.'

/** Sem credenciais (`user:pass@`) e com domínio; o esquema é sensível a maiúsculas (CHECK do banco). */
const LINK_HTTPS = /^https:\/\/[^\s/?#@]+\.[^\s/?#@]+(?:[/?#]\S*)?$/

export function ehLinkHttps(link: string): boolean {
  return LINK_HTTPS.test(link)
}

export const tituloBannerSchema = z
  .string({ error: 'Informe o título.' })
  .trim()
  .min(TITULO_BANNER_MIN, { error: `O título deve ter ao menos ${TITULO_BANNER_MIN} caracteres.` })
  .max(TITULO_BANNER_MAX, {
    error: `O título deve ter no máximo ${TITULO_BANNER_MAX} caracteres.`,
  })

export const linkBannerSchema = z
  .string({ error: 'Link inválido.' })
  .max(LINK_BANNER_MAX, { error: `O link deve ter no máximo ${LINK_BANNER_MAX} caracteres.` })
  .refine((link) => link.startsWith('https://'), { error: MENSAGEM_LINK_HTTPS, abort: true })
  .refine(ehLinkHttps, { error: 'Link inválido.' })

/** Vazio vira `null` (sem link, RN34). */
export const linkOpcionalSchema = z
  .string({ error: 'Link inválido.' })
  .trim()
  .transform((link) => link || null)
  .pipe(linkBannerSchema.nullable())

/** Chave devolvida pelo presign (finalidade `BANNER`). */
export const chaveImagemBannerSchema = z
  .string({ error: MENSAGEM_IMAGEM_BANNER })
  .min(1, { error: MENSAGEM_IMAGEM_BANNER })
  .max(CHAVE_IMAGEM_BANNER_MAX, { error: 'Imagem inválida.' })

const ativoSchema = z.boolean({ error: 'Use true ou false.' })

/** `POST /painel/banners`; nasce ativo e no fim da ordem. */
export const bannerCreateSchema = z
  .object({
    titulo: tituloBannerSchema,
    imagemKey: chaveImagemBannerSchema,
    link: linkOpcionalSchema.nullish(),
    ativo: ativoSchema.optional(),
  })
  .strict()

/** `link: null` ou vazio remove o link; a ordem muda só por `PUT /painel/banners/ordem`. */
export const bannerUpdateSchema = z
  .object({
    titulo: tituloBannerSchema,
    imagemKey: chaveImagemBannerSchema,
    link: linkOpcionalSchema.nullable(),
    ativo: ativoSchema,
  })
  .partial()
  .strict()
  .refine((dados) => Object.keys(dados).length > 0, { error: 'Informe ao menos um campo.' })

/** Todos os banners da atlética, ativos e inativos, na nova ordem. */
export const bannersOrdemSchema = z
  .object({
    ids: z
      .array(z.uuid({ error: 'Id inválido.' }), { error: 'Informe a lista de ids.' })
      .min(1, { error: 'Informe a lista de ids.' })
      .max(ORDEM_BANNERS_MAX, { error: `Informe no máximo ${ORDEM_BANNERS_MAX} ids.` }),
  })
  .strict()

export const bannersPainelQuerySchema = paginacaoQuerySchema

/** Formulário do app: na edição, a imagem salva não tem chave (só muda ao trocar). */
export const bannerFormSchema = z
  .object({
    titulo: tituloBannerSchema,
    imagemKey: chaveImagemBannerSchema.optional(),
    link: linkOpcionalSchema,
    ativo: ativoSchema,
  })
  .strict()

export type BannerCriacao = z.infer<typeof bannerCreateSchema>
export type BannerAtualizacao = z.infer<typeof bannerUpdateSchema>
export type BannersOrdem = z.infer<typeof bannersOrdemSchema>
export type BannersPainelQuery = z.infer<typeof bannersPainelQuerySchema>
export type BannerForm = z.input<typeof bannerFormSchema>
export type DadosBannerForm = z.output<typeof bannerFormSchema>
