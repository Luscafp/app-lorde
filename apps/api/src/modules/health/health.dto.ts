import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const identificacao = {
  versao: z.string().meta({ example: '1.4.0' }),
  commit: z.string().meta({ example: 'a1b2c3d', description: '"desconhecido" sem GIT_COMMIT_SHA' }),
}

const saudeOkSchema = z.object({
  status: z.literal('ok'),
  ...identificacao,
  banco: z.literal('ok'),
})

const saudeErroSchema = z.object({
  status: z.literal('erro'),
  ...identificacao,
  banco: z.literal('indisponivel'),
})

export type RespostaSaude = z.infer<typeof saudeOkSchema> | z.infer<typeof saudeErroSchema>

export class SaudeOkDto extends createZodDto(saudeOkSchema) {}
export class SaudeErroDto extends createZodDto(saudeErroSchema) {}
