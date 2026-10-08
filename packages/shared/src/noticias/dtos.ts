import { z } from 'zod'
import { StatusNoticia } from '../enums/noticia'
import { respostaPaginadaSchema } from '../utils/paginacao'
import { tagResumoSchema } from './tags'

const noticiaBaseSchema = z.object({
  id: z.uuid(),
  titulo: z.string(),
  imagemCapaUrl: z.string().nullable(),
  publicadaEm: z.iso.datetime(),
  /** Ordenadas por nome. */
  tags: z.array(tagResumoSchema),
})

/** Item de `GET /noticias`: `resumo` em texto puro, sem marcação Markdown. */
export const noticiaResumoSchema = noticiaBaseSchema.extend({ resumo: z.string() }).strict()

export const listaNoticiasSchema = respostaPaginadaSchema(noticiaResumoSchema)

/** `GET /noticias/:id`: `conteudo` em Markdown restrito, renderizado no app. */
export const noticiaDetalheSchema = noticiaBaseSchema.extend({ conteudo: z.string() }).strict()

/** Item de `GET /painel/noticias`: rascunhos e publicadas não excluídas. */
export const noticiaPainelSchema = noticiaBaseSchema
  .extend({
    status: z.enum(StatusNoticia),
    /** `null` em rascunho nunca publicado; mantida ao despublicar. */
    publicadaEm: z.iso.datetime().nullable(),
    criadoEm: z.iso.datetime(),
    atualizadoEm: z.iso.datetime(),
    autor: z.object({ id: z.uuid(), nome: z.string() }).strict(),
  })
  .strict()

export const listaNoticiasPainelSchema = respostaPaginadaSchema(noticiaPainelSchema)

/** `GET /painel/noticias/:id` e respostas das escritas. */
export const noticiaPainelDetalheSchema = noticiaPainelSchema
  .extend({ conteudo: z.string() })
  .strict()

export type NoticiaResumoDto = z.infer<typeof noticiaResumoSchema>
export type ListaNoticias = z.infer<typeof listaNoticiasSchema>
export type NoticiaDetalheDto = z.infer<typeof noticiaDetalheSchema>
export type NoticiaPainelDto = z.infer<typeof noticiaPainelSchema>
export type ListaNoticiasPainel = z.infer<typeof listaNoticiasPainelSchema>
export type NoticiaPainelDetalheDto = z.infer<typeof noticiaPainelDetalheSchema>
