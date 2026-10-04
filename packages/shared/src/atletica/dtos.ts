import { z } from 'zod'

const COR = /^#[0-9A-Fa-f]{6}$/

/** Resposta de `GET /atletica`: só marca e contato público, campos sempre presentes (épico #6 §7). */
export const atleticaPublicaSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    sigla: z.string().nullable(),
    curso: z.string().nullable(),
    logoUrl: z.string().nullable(),
    corPrimaria: z.string().regex(COR).nullable(),
    corSecundaria: z.string().regex(COR).nullable(),
    contatoEmail: z.string().nullable(),
    contatoInstagram: z.string().nullable(),
    contatoWhatsapp: z.string().nullable(),
  })
  .strict()

export type AtleticaPublica = z.infer<typeof atleticaPublicaSchema>
