import { z } from 'zod'
import { preferenciasSchema } from './dtos'

export const atualizarPreferenciasSchema = preferenciasSchema
  .partial()
  .strict()
  .refine((valor) => Object.keys(valor).length > 0, { error: 'Informe ao menos um campo.' })

export type AtualizarPreferencias = z.infer<typeof atualizarPreferenciasSchema>

/** Corpo de `POST /me/dispositivos` (épico #36 §6). */
export const registrarDispositivoSchema = z
  .object({
    tokenPush: z
      .string()
      .max(255)
      .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, { error: 'Token push inválido.' }),
    plataforma: z.enum(['android'], { error: 'Plataforma não suportada.' }),
  })
  .strict()

export type RegistrarDispositivo = z.infer<typeof registrarDispositivoSchema>

export const TITULO_AVISO_MIN = 3
export const TITULO_AVISO_MAX = 65
export const MENSAGEM_AVISO_MIN = 3
export const MENSAGEM_AVISO_MAX = 500

export const DestinoAviso = { TODOS: 'TODOS', TIME: 'TIME' } as const

export type DestinoAviso = (typeof DestinoAviso)[keyof typeof DestinoAviso]

const tituloAvisoSchema = z
  .string({ error: 'Informe o título.' })
  .trim()
  .min(TITULO_AVISO_MIN, { error: `O título deve ter ao menos ${TITULO_AVISO_MIN} caracteres.` })
  .max(TITULO_AVISO_MAX, { error: `O título deve ter no máximo ${TITULO_AVISO_MAX} caracteres.` })

const mensagemAvisoSchema = z
  .string({ error: 'Informe a mensagem.' })
  .trim()
  .min(MENSAGEM_AVISO_MIN, {
    error: `A mensagem deve ter ao menos ${MENSAGEM_AVISO_MIN} caracteres.`,
  })
  .max(MENSAGEM_AVISO_MAX, {
    error: `A mensagem deve ter no máximo ${MENSAGEM_AVISO_MAX} caracteres.`,
  })

const timeIdAvisoSchema = z.uuid({ error: 'Selecione o time.' })
const ERRO_DESTINO = { error: 'Escolha TODOS ou TIME.' }
const textoAviso = { titulo: tituloAvisoSchema, mensagem: mensagemAvisoSchema }

/** Corpo de `POST /avisos` (issue #38). */
export const enviarAvisoSchema = z.discriminatedUnion(
  'destino',
  [
    z.object({ destino: z.literal(DestinoAviso.TODOS), ...textoAviso }).strict(),
    z
      .object({ destino: z.literal(DestinoAviso.TIME), timeId: timeIdAvisoSchema, ...textoAviso })
      .strict(),
  ],
  ERRO_DESTINO,
)

export type EnviarAviso = z.infer<typeof enviarAvisoSchema>

/** Consulta de `GET /avisos/alcance`: objeto (o Swagger não aceita união em `@Query`), mesmas regras. */
export const alcanceAvisoQuerySchema = z
  .object({
    destino: z.enum(DestinoAviso, ERRO_DESTINO),
    timeId: timeIdAvisoSchema.optional(),
  })
  .strict()
  .refine(({ destino, timeId }) => destino === DestinoAviso.TODOS || timeId !== undefined, {
    error: 'Selecione o time.',
    path: ['timeId'],
  })
  .refine(({ destino, timeId }) => destino === DestinoAviso.TIME || timeId === undefined, {
    error: 'O time só vale para o destino TIME.',
    path: ['timeId'],
  })

export type AlcanceAvisoQuery = z.infer<typeof alcanceAvisoQuerySchema>

/** Formulário do app: `timeId` só é exigido com destino `TIME`. */
export const avisoFormSchema = z
  .object({
    destino: z.enum(DestinoAviso),
    timeId: z.string(),
    ...textoAviso,
  })
  .refine(({ destino, timeId }) => destino === DestinoAviso.TODOS || timeId !== '', {
    error: 'Selecione o time.',
    path: ['timeId'],
  })

export type AvisoForm = z.input<typeof avisoFormSchema>
export type DadosAvisoForm = z.output<typeof avisoFormSchema>

/** Corpo do envio a partir do formulário (descarta `timeId` quando o destino é `TODOS`). */
export function avisoDoFormulario({
  destino,
  timeId,
  titulo,
  mensagem,
}: DadosAvisoForm): EnviarAviso {
  return destino === DestinoAviso.TIME
    ? { destino, timeId, titulo, mensagem }
    : { destino, titulo, mensagem }
}
