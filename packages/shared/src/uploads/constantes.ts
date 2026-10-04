/** Uso da imagem enviada ao R2. Sem enum no Prisma: a chave fica na entidade. */
export const FinalidadeUpload = {
  PERFIL: 'PERFIL',
  NOTICIA: 'NOTICIA',
  BANNER: 'BANNER',
} as const

export type FinalidadeUpload = (typeof FinalidadeUpload)[keyof typeof FinalidadeUpload]

/** RNF04: 5 MB por arquivo e no máximo 1080 px de largura (o app redimensiona). */
export const TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024
export const LARGURA_MAXIMA_IMAGEM = 1080

export const EXTENSAO_POR_TIPO_IMAGEM = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

export type TipoImagem = keyof typeof EXTENSAO_POR_TIPO_IMAGEM

export const TIPOS_IMAGEM = Object.keys(EXTENSAO_POR_TIPO_IMAGEM) as [TipoImagem, ...TipoImagem[]]

/** Formatos oficiais da chave (convenções §11.5); a API gera e valida. */
export const FORMATO_CHAVE_UPLOAD: Record<FinalidadeUpload, string> = {
  PERFIL: 'usuarios/{usuarioId}/perfil/{uuid}.{ext}',
  NOTICIA: 'atleticas/{atleticaId}/noticias/{usuarioId}/{uuid}.{ext}',
  BANNER: 'atleticas/{atleticaId}/banners/{usuarioId}/{uuid}.{ext}',
}
