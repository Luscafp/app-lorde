import { z } from 'zod'
import { FinalidadeUpload, TAMANHO_MAXIMO_IMAGEM, TIPOS_IMAGEM } from './constantes'

const TAMANHO_INVALIDO = 'Informe o tamanho da imagem em bytes.'

/** Corpo de `POST /uploads/presign` (épico #9 §7). */
export const presignRequestSchema = z
  .object({
    finalidade: z.enum(FinalidadeUpload, { error: 'Finalidade inválida.' }),
    contentType: z.enum(TIPOS_IMAGEM, { error: 'Envie uma imagem JPEG, PNG ou WebP.' }),
    tamanhoBytes: z
      .number({ error: TAMANHO_INVALIDO })
      .int({ error: TAMANHO_INVALIDO })
      .min(1, { error: TAMANHO_INVALIDO })
      .max(TAMANHO_MAXIMO_IMAGEM, { error: 'A imagem deve ter no máximo 5 MB.' }),
  })
  .strict()

export type PresignRequest = z.infer<typeof presignRequestSchema>
