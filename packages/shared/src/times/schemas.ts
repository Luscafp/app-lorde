import { z } from 'zod'
import { paginacaoQuerySchema } from '../utils/paginacao'
import { booleanoQuerySchema } from '../utils/query'
import { normalizarEspacos } from '../utils/texto'

export const NOME_TIME_MIN = 2
export const NOME_TIME_MAX = 60
export const BUSCA_TIMES_MAX = 100

export const nomeTimeSchema = z
  .string({ error: 'Informe o nome do time.' })
  .transform(normalizarEspacos)
  .pipe(
    z
      .string()
      .min(NOME_TIME_MIN, { error: `O nome deve ter ao menos ${NOME_TIME_MIN} caracteres.` })
      .max(NOME_TIME_MAX, { error: `O nome deve ter no máximo ${NOME_TIME_MAX} caracteres.` }),
  )

const modalidadeIdSchema = z.uuid({ error: 'Escolha a modalidade.' })

/** `atleticaAdversariaId` nulo ou ausente: time da atlética ativa (épico #16 §7). */
export const timeCreateSchema = z
  .object({
    nome: nomeTimeSchema,
    modalidadeId: modalidadeIdSchema,
    atleticaAdversariaId: z.uuid({ error: 'Atlética adversária inválida.' }).nullish(),
  })
  .strict()

/** A atlética do time é imutável: `.strict()` rejeita `atleticaAdversariaId`. */
export const timeUpdateSchema = z
  .object({
    nome: nomeTimeSchema,
    modalidadeId: modalidadeIdSchema,
    ativo: z.boolean({ error: 'Informe se o time está ativo.' }),
  })
  .partial()
  .strict()
  .refine((dados) => Object.keys(dados).length > 0, { error: 'Informe ao menos um campo.' })

export const EscopoTimes = { PROPRIOS: 'PROPRIOS', ADVERSARIOS: 'ADVERSARIOS' } as const

export type EscopoTimes = (typeof EscopoTimes)[keyof typeof EscopoTimes]

/** `incluirInativos` só vale para a Diretoria; para os demais é ignorado (épico #16 §7). */
export const timesQuerySchema = paginacaoQuerySchema
  .extend({
    modalidadeId: z.uuid({ error: 'Modalidade inválida.' }).optional(),
    escopo: z.enum(EscopoTimes, { error: 'Use PROPRIOS ou ADVERSARIOS.' }).default('PROPRIOS'),
    atleticaId: z.uuid({ error: 'Atlética inválida.' }).optional(),
    q: z
      .string()
      .trim()
      .max(BUSCA_TIMES_MAX, { error: `A busca deve ter no máximo ${BUSCA_TIMES_MAX} caracteres.` })
      .transform((valor) => valor || undefined)
      .optional(),
    incluirInativos: booleanoQuerySchema,
  })
  .strict()

export const timeIdSchema = z.object({ id: z.uuid({ error: 'Id inválido.' }) }).strict()

export const membroElencoParamsSchema = z
  .object({
    id: z.uuid({ error: 'Id inválido.' }),
    usuarioId: z.uuid({ error: 'Usuário inválido.' }),
  })
  .strict()

/** `usuarioId: null` remove o capitão (épico #16 §7). */
export const capitaoUpdateSchema = z
  .object({ usuarioId: z.uuid({ error: 'Usuário inválido.' }).nullable() })
  .strict()

export type TimeCriacao = z.infer<typeof timeCreateSchema>
export type TimeAtualizacao = z.infer<typeof timeUpdateSchema>
export type TimesQuery = z.infer<typeof timesQuerySchema>
export type FiltrosTimes = Omit<z.input<typeof timesQuerySchema>, 'page' | 'limit'>
export type TimeForm = z.input<typeof timeCreateSchema>
export type CapitaoAtualizacao = z.infer<typeof capitaoUpdateSchema>
