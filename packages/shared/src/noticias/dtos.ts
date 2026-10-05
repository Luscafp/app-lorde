import { z } from 'zod'
import { respostaPaginadaSchema } from '../utils/paginacao'

/** Item de `GET /noticias`: `resumo` em texto puro, sem marcação Markdown. */
export const noticiaResumoSchema = z
  .object({
    id: z.uuid(),
    titulo: z.string(),
    imagemCapaUrl: z.string().nullable(),
    publicadaEm: z.iso.datetime(),
    resumo: z.string(),
  })
  .strict()

export const listaNoticiasSchema = respostaPaginadaSchema(noticiaResumoSchema)

/** `GET /noticias/:id`: `conteudo` em Markdown restrito, renderizado no app. */
export const noticiaDetalheSchema = z
  .object({
    id: z.uuid(),
    titulo: z.string(),
    conteudo: z.string(),
    imagemCapaUrl: z.string().nullable(),
    publicadaEm: z.iso.datetime(),
  })
  .strict()

export type NoticiaResumoDto = z.infer<typeof noticiaResumoSchema>
export type ListaNoticias = z.infer<typeof listaNoticiasSchema>
export type NoticiaDetalheDto = z.infer<typeof noticiaDetalheSchema>
