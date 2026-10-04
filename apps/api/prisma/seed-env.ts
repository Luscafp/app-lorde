import { senhaSchema } from '@atletica/shared'
import { z } from 'zod'
import {
  appEnvExigidaEmProducao,
  appEnvSchema,
  databaseUrlSchema,
  listarVariaveisInvalidas,
  vazioComoAusente,
} from '../src/config/env-comum'

/** Falha do seed com mensagem para quem o executa; nunca inclui valores das variáveis. */
export class ErroSeed extends Error {
  override readonly name = 'ErroSeed'
}

const DICAS = {
  SEED_ADMIN_SENHA: 'política de senha do UC06: 8 a 128 caracteres, ao menos uma letra e um número',
}

const obrigatoria = { error: 'obrigatória' }

/** Variáveis do seed, validadas só por ele (issue #45): a API sobe sem elas. */
export const envSeedSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    APP_ENV: vazioComoAusente(appEnvSchema.default('local')),
    DATABASE_URL: databaseUrlSchema,
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
  .refine(...appEnvExigidaEmProducao)
  .refine((env) => !(env.SEED_DEMO && env.APP_ENV === 'producao'), {
    path: ['SEED_DEMO'],
    error: 'dados de demonstração nunca são gravados em produção (APP_ENV=producao)',
  })

export type EnvSeed = z.infer<typeof envSeedSchema>

export function validarEnvSeed(variaveis: Record<string, string | undefined>): EnvSeed {
  const resultado = envSeedSchema.safeParse(variaveis)
  if (resultado.success) return resultado.data
  throw new ErroSeed(
    `Seed abortado, nada foi gravado. Variáveis inválidas:\n${listarVariaveisInvalidas(resultado.error, DICAS)}`,
  )
}
