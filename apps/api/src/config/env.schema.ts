import { z } from 'zod'

/**
 * Schema único das variáveis de ambiente da API (convenções §4.3).
 * Cada issue que cria uma variável a acrescenta aqui.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'development', 'homologacao', 'producao']).default('local'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: 'obrigatória, no formato postgresql://',
  }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
})

export type Env = z.infer<typeof envSchema>

/** Erro de configuração: a mensagem lista as variáveis com problema, nunca os valores. */
export class ErroConfiguracao extends Error {
  override readonly name = 'ErroConfiguracao'
}

export function validarEnv(config: Record<string, unknown>): Env {
  const resultado = envSchema.safeParse(config)
  if (resultado.success) return resultado.data

  const linhas = resultado.error.issues.map(
    (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
  )
  throw new ErroConfiguracao(`Variáveis de ambiente inválidas:\n${linhas.join('\n')}`)
}
