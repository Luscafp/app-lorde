import { z } from 'zod'

/** Resposta do presign; nomes em inglês por contrato (convenções §2). */
export const presignRespostaSchema = z
  .object({
    uploadUrl: z.url(),
    key: z.string(),
    publicUrl: z.url(),
    expiresAt: z.iso.datetime(),
  })
  .strict()

export type PresignResposta = z.infer<typeof presignRespostaSchema>
