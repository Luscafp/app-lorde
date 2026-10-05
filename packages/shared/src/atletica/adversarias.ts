import { z } from 'zod'
import { paginacaoQuerySchema, respostaPaginadaSchema } from '../utils/paginacao'
import { normalizarEspacos } from '../utils/texto'

export const NOME_ATLETICA_MIN = 2
export const NOME_ATLETICA_MAX = 80
export const SIGLA_ATLETICA_MAX = 10
export const CURSO_ATLETICA_MAX = 80

const nomeAtleticaSchema = z
  .string({ error: 'Informe o nome da atlética.' })
  .transform(normalizarEspacos)
  .pipe(
    z
      .string()
      .min(NOME_ATLETICA_MIN, {
        error: `O nome deve ter ao menos ${NOME_ATLETICA_MIN} caracteres.`,
      })
      .max(NOME_ATLETICA_MAX, {
        error: `O nome deve ter no máximo ${NOME_ATLETICA_MAX} caracteres.`,
      }),
  )

/** Texto opcional: vazio ou só espaços vira `null`. */
function textoOpcional(max: number, mensagem: string, formatar = (valor: string) => valor) {
  return z
    .string()
    .nullish()
    .transform((valor) => (valor ? normalizarEspacos(valor) : '') || null)
    .pipe(z.string().max(max, { error: mensagem }).transform(formatar).nullable())
}

const siglaSchema = textoOpcional(
  SIGLA_ATLETICA_MAX,
  `A sigla deve ter no máximo ${SIGLA_ATLETICA_MAX} caracteres.`,
  (valor) => valor.toUpperCase(),
)

const cursoSchema = textoOpcional(
  CURSO_ATLETICA_MAX,
  `O curso deve ter no máximo ${CURSO_ATLETICA_MAX} caracteres.`,
)

/** `usaAplicativo` é sempre `false` e não é aceito no corpo (épico #16 §3 item 1). */
export const atleticaAdversariaSchema = z
  .object({ nome: nomeAtleticaSchema, sigla: siglaSchema, curso: cursoSchema })
  .strict()

export const atleticaAdversariaUpdateSchema = z
  .object({ nome: nomeAtleticaSchema, sigla: siglaSchema, curso: cursoSchema })
  .partial()
  .strict()
  .refine((dados) => Object.keys(dados).length > 0, { error: 'Informe ao menos um campo.' })

export const atleticasAdversariasQuerySchema = paginacaoQuerySchema
  .extend({
    q: z
      .string()
      .trim()
      .max(NOME_ATLETICA_MAX, {
        error: `A busca deve ter no máximo ${NOME_ATLETICA_MAX} caracteres.`,
      })
      .transform((valor) => valor || undefined)
      .optional(),
  })
  .strict()

export const atleticaAdversariaIdSchema = z
  .object({ id: z.uuid({ error: 'Id inválido.' }) })
  .strict()

export const atleticaAdversariaDtoSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    sigla: z.string().nullable(),
    curso: z.string().nullable(),
    totalTimes: z.number().int(),
  })
  .strict()

export const listaAtleticasAdversariasSchema = respostaPaginadaSchema(atleticaAdversariaDtoSchema)

export type AtleticaAdversariaCriacao = z.infer<typeof atleticaAdversariaSchema>
export type AtleticaAdversariaAtualizacao = z.infer<typeof atleticaAdversariaUpdateSchema>
export type AtleticasAdversariasQuery = z.infer<typeof atleticasAdversariasQuerySchema>
export type AtleticaAdversaria = z.infer<typeof atleticaAdversariaDtoSchema>
export type ListaAtleticasAdversarias = z.infer<typeof listaAtleticasAdversariasSchema>
export type AtleticaAdversariaForm = z.input<typeof atleticaAdversariaSchema>
