import { z } from 'zod'
import { ICONES_MODALIDADE } from './icones'

export const NOME_MODALIDADE_MIN = 2
export const NOME_MODALIDADE_MAX = 40

/** `trim` + espaços internos colapsados; a unicidade é sem diferenciar maiúsculas (API). */
export function normalizarNomeModalidade(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ')
}

export const nomeModalidadeSchema = z
  .string({ error: 'Informe o nome da modalidade.' })
  .transform(normalizarNomeModalidade)
  .pipe(
    z
      .string()
      .min(NOME_MODALIDADE_MIN, {
        error: `O nome deve ter ao menos ${NOME_MODALIDADE_MIN} caracteres.`,
      })
      .max(NOME_MODALIDADE_MAX, {
        error: `O nome deve ter no máximo ${NOME_MODALIDADE_MAX} caracteres.`,
      }),
  )

export const iconeModalidadeSchema = z.enum(ICONES_MODALIDADE, { error: 'Escolha um ícone.' })

export const modalidadeCreateSchema = z
  .object({ nome: nomeModalidadeSchema, icone: iconeModalidadeSchema })
  .strict()

export const modalidadeUpdateSchema = z
  .object({
    nome: nomeModalidadeSchema,
    icone: iconeModalidadeSchema,
    ativa: z.boolean({ error: 'Informe se a modalidade está ativa.' }),
  })
  .partial()
  .strict()
  .refine((dados) => Object.keys(dados).length > 0, { error: 'Informe ao menos um campo.' })

/** `incluirInativas` só vale para a Diretoria; para os demais é ignorado (issue #15 §7). */
export const modalidadesQuerySchema = z
  .object({
    incluirInativas: z
      .enum(['true', 'false'], { error: 'Use true ou false.' })
      .default('false')
      .transform((valor) => valor === 'true'),
  })
  .strict()

export const modalidadeIdSchema = z.object({ id: z.uuid({ error: 'Id inválido.' }) }).strict()

export type ModalidadeCriacao = z.infer<typeof modalidadeCreateSchema>
export type ModalidadeAtualizacao = z.infer<typeof modalidadeUpdateSchema>
export type ModalidadesQuery = z.infer<typeof modalidadesQuerySchema>
export type ModalidadeForm = z.input<typeof modalidadeCreateSchema>
