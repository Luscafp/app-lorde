import { z } from 'zod'
import { paginacaoQuerySchema, respostaPaginadaSchema } from '../utils/paginacao'
import { normalizarEspacos } from '../utils/texto'

export const TAGS_POR_NOTICIA_MAX = 5
export const TAG_MIN = 2
export const TAG_MAX = 30

export const MENSAGEM_MAXIMO_TAGS = `Máximo de ${TAGS_POR_NOTICIA_MAX} tags`

const FORMATO_TAG = /^[\p{L}\p{N} -]+$/u

/** Chave única por atlética (convenções §11.4): sem acentos nem caixa. */
export function normalizarNomeTag(nome: string): string {
  return normalizarEspacos(nome).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** A primeira grafia de cada nome normalizado vence. */
export function semTagsRepetidas(nomes: readonly string[]): string[] {
  const vistos = new Set<string>()
  return nomes.filter((nome) => {
    const chave = normalizarNomeTag(nome)
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}

export const nomeTagSchema = z
  .string({ error: 'Tag inválida.' })
  .transform(normalizarEspacos)
  .pipe(
    z
      .string()
      .min(TAG_MIN, { error: `A tag deve ter ao menos ${TAG_MIN} caracteres.` })
      .max(TAG_MAX, { error: `A tag deve ter no máximo ${TAG_MAX} caracteres.` })
      .regex(FORMATO_TAG, { error: 'Use só letras, números, espaço e hífen.' }),
  )

export const tagsNoticiaSchema = z
  .array(nomeTagSchema, { error: 'Informe uma lista de tags.' })
  .max(TAGS_POR_NOTICIA_MAX, { error: MENSAGEM_MAXIMO_TAGS })
  .transform(semTagsRepetidas)

export const tagResumoSchema = z.object({ id: z.uuid(), nome: z.string() }).strict()

export const tagSchema = tagResumoSchema.extend({ totalNoticias: z.number().int() }).strict()

export const listaTagsSchema = respostaPaginadaSchema(tagSchema)

/** `emUso=false` só vale do Diretor para cima; para o Atleta a API força `true`. */
export const tagsQuerySchema = paginacaoQuerySchema
  .extend({
    q: z
      .string()
      .trim()
      .max(TAG_MAX, { error: `A busca deve ter no máximo ${TAG_MAX} caracteres.` })
      .transform((valor) => valor || undefined)
      .optional(),
    emUso: z
      .enum(['true', 'false'], { error: 'Use true ou false.' })
      .default('true')
      .transform((valor) => valor === 'true'),
  })
  .strict()

export type TagResumoDto = z.infer<typeof tagResumoSchema>
export type TagDto = z.infer<typeof tagSchema>
export type ListaTags = z.infer<typeof listaTagsSchema>
export type TagsQuery = z.infer<typeof tagsQuerySchema>
export type FiltrosTags = Partial<Omit<TagsQuery, 'page' | 'limit'>>
