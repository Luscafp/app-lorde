import { senhaSchema } from '@atletica/shared'
import { z } from 'zod'

/** Falha do seed com mensagem para quem o executa; nunca inclui valores das variáveis. */
export class ErroSeed extends Error {
  override readonly name = 'ErroSeed'
}

const POLITICA_SENHA =
  'política de senha do UC06: 8 a 128 caracteres, ao menos uma letra e um número'

// O dotenv lê `VAR=` como '': vazia conta como ausente.
function vazioComoAusente<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
    schema,
  )
}

const obrigatoria = { error: 'obrigatória' }

/** Variáveis do seed, validadas só por ele: a API sobe sem elas. */
export const envSeedSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    APP_ENV: vazioComoAusente(
      z.enum(['local', 'development', 'homologacao', 'producao']).default('local'),
    ),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: 'obrigatória, no formato postgresql://',
    }),
    SEED_ADMIN_EMAIL: vazioComoAusente(
      z
        .string(obrigatoria)
        .trim()
        .toLowerCase()
        .pipe(z.email({ error: 'deve ser um e-mail válido' }).max(254)),
    ),
    SEED_ADMIN_NOME: vazioComoAusente(
      z.string(obrigatoria).trim().min(2, { error: 'deve ter de 2 a 80 caracteres' }).max(80),
    ),
    SEED_ADMIN_SENHA: vazioComoAusente(z.string(obrigatoria).pipe(senhaSchema)),
    SEED_DEMO: vazioComoAusente(
      z
        .enum(['true', 'false'], { error: 'deve ser true ou false' })
        .default('false')
        .transform((valor) => valor === 'true'),
    ),
  })
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' || env.APP_ENV === 'homologacao' || env.APP_ENV === 'producao',
    { path: ['APP_ENV'], error: 'obrigatória com NODE_ENV=production (homologacao | producao)' },
  )
  .refine((env) => !(env.SEED_DEMO && env.APP_ENV === 'producao'), {
    path: ['SEED_DEMO'],
    error: 'dados de demonstração nunca são gravados em produção (APP_ENV=producao)',
  })

export type EnvSeed = z.infer<typeof envSeedSchema>

export function validarEnvSeed(variaveis: Record<string, string | undefined>): EnvSeed {
  const resultado = envSeedSchema.safeParse(variaveis)
  if (resultado.success) return resultado.data

  const linhas = resultado.error.issues.map((issue) => {
    const campo = issue.path.join('.')
    const dica = campo === 'SEED_ADMIN_SENHA' ? ` (${POLITICA_SENHA})` : ''
    return `  - ${campo}: ${issue.message}${dica}`
  })
  throw new ErroSeed(`Seed abortado, nada foi gravado. Variáveis inválidas:\n${linhas.join('\n')}`)
}
