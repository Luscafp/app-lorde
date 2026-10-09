import { z } from 'zod'
import { StatusNoticia } from '../enums/noticia'
import { paginacaoQuerySchema } from '../utils/paginacao'
import { tagsNoticiaSchema } from './tags'

export const TITULO_NOTICIA_MIN = 3
export const TITULO_NOTICIA_MAX = 120
export const CONTEUDO_NOTICIA_MAX = 10_000
export const BUSCA_NOTICIAS_MAX = 100
export const CHAVE_CAPA_MAX = 300

const PERMITIDOS = new Set(['\t', '\n', '\r'])

/** Quebras de linha e tabulação são permitidas; os demais caracteres de controle, não. */
function semControle(texto: string): boolean {
  return ![...texto].some((c) => (c < ' ' || c === '\u007f') && !PERMITIDOS.has(c))
}

export const tagIdSchema = z.uuid({ error: 'Tag inválida.' })

/** Query de `GET /noticias`; `tagId` de outra atlética resulta em lista vazia. */
export const listarNoticiasQuerySchema = paginacaoQuerySchema
  .extend({ tagId: tagIdSchema.optional() })
  .strict()

export const tituloNoticiaSchema = z
  .string({ error: 'Informe o título.' })
  .trim()
  .min(TITULO_NOTICIA_MIN, {
    error: `O título deve ter ao menos ${TITULO_NOTICIA_MIN} caracteres.`,
  })
  .max(TITULO_NOTICIA_MAX, {
    error: `O título deve ter no máximo ${TITULO_NOTICIA_MAX} caracteres.`,
  })
  .refine(semControle, { error: 'Título inválido.' })

/** Rascunho: vazio permitido (convenções §11.4). */
export const conteudoNoticiaSchema = z
  .string({ error: 'Informe o conteúdo.' })
  .max(CONTEUDO_NOTICIA_MAX, {
    error: `O conteúdo deve ter no máximo ${CONTEUDO_NOTICIA_MAX} caracteres.`,
  })
  .refine(semControle, { error: 'Conteúdo inválido.' })

/** Chave devolvida pelo presign (finalidade `NOTICIA`); `null` remove a capa. */
export const chaveCapaSchema = z
  .string({ error: 'Imagem de capa inválida.' })
  .min(1, { error: 'Imagem de capa inválida.' })
  .max(CHAVE_CAPA_MAX, { error: 'Imagem de capa inválida.' })

const camposRascunho = {
  titulo: tituloNoticiaSchema,
  conteudo: conteudoNoticiaSchema.optional(),
  imagemCapaKey: chaveCapaSchema.nullish(),
  tags: tagsNoticiaSchema.optional(),
}

export const noticiaRascunhoSchema = z.object(camposRascunho).strict()

export const CONTEUDO_OBRIGATORIO = 'Escreva o conteúdo para publicar.'
export const CAPA_OBRIGATORIA = 'Escolha a imagem de capa para publicar.'

/** Requisitos para publicar (convenções §11.4 e §11.9); a API responde `422` com o code. */
export const noticiaPublicacaoSchema = z
  .object({
    titulo: tituloNoticiaSchema,
    conteudo: z
      .string({ error: CONTEUDO_OBRIGATORIO })
      .pipe(conteudoNoticiaSchema)
      .refine((conteudo) => conteudo.trim().length > 0, { error: CONTEUDO_OBRIGATORIO }),
    imagemCapaKey: z.string({ error: CAPA_OBRIGATORIA }).pipe(chaveCapaSchema),
  })
  .strict()

/** `POST /painel/noticias`; `publicar: true` cria já publicada. */
export const noticiaCreateSchema = z
  .object({ ...camposRascunho, publicar: z.boolean({ error: 'Use true ou false.' }).optional() })
  .strict()

/** `status` muda só por `/publicar` e `/despublicar`. */
export const noticiaUpdateSchema = z
  .object({
    titulo: tituloNoticiaSchema,
    conteudo: conteudoNoticiaSchema,
    imagemCapaKey: chaveCapaSchema.nullable(),
    /** Substitui o conjunto; `[]` remove todas. */
    tags: tagsNoticiaSchema,
  })
  .partial()
  .strict()
  .refine((dados) => Object.keys(dados).length > 0, { error: 'Informe ao menos um campo.' })

export const noticiasPainelQuerySchema = paginacaoQuerySchema
  .extend({
    status: z.enum(StatusNoticia, { error: 'Use RASCUNHO ou PUBLICADA.' }).optional(),
    q: z
      .string()
      .trim()
      .max(BUSCA_NOTICIAS_MAX, {
        error: `A busca deve ter no máximo ${BUSCA_NOTICIAS_MAX} caracteres.`,
      })
      .transform((valor) => valor || undefined)
      .optional(),
    tagId: tagIdSchema.optional(),
  })
  .strict()

export type ListarNoticiasQuery = z.infer<typeof listarNoticiasQuerySchema>
export type NoticiaCriacao = z.infer<typeof noticiaCreateSchema>
export type NoticiaAtualizacao = z.infer<typeof noticiaUpdateSchema>
export type NoticiasPainelQuery = z.infer<typeof noticiasPainelQuerySchema>
export type FiltrosNoticiasPainel = Omit<
  z.input<typeof noticiasPainelQuerySchema>,
  'page' | 'limit'
>
export type NoticiaForm = z.input<typeof noticiaRascunhoSchema>
