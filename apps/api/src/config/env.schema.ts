import { z } from 'zod'

/** Vazia conta como ausente: o `.env.example` traz variáveis opcionais vazias e o dotenv as lê como ''. */
function vaziaComoAusente<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
    schema,
  )
}

/**
 * Schema único das variáveis de ambiente da API (convenções §4.3).
 * Cada issue que cria uma variável a acrescenta aqui.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['local', 'development', 'homologacao', 'producao']).optional(),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: 'obrigatória, no formato postgresql://',
    }),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    // E-mail transacional (#61): resend em homologação/produção, fake nos testes, log em desenvolvimento.
    EMAIL_PROVIDER: z.enum(['resend', 'fake', 'log'], {
      error: 'obrigatória (resend | fake | log)',
    }),
    RESEND_API_KEY: vaziaComoAusente(z.string().trim().optional()),
    EMAIL_REMETENTE: z
      .string()
      .trim()
      .min(3, { error: 'obrigatória (ex.: "Nome <email@dominio>")' }),
    // Segredo do HMAC dos códigos de verificação (#61, usado pela #62 e #31).
    CODIGO_PEPPER: z.string().min(32, { error: 'obrigatória, com ao menos 32 caracteres' }),
    // Segredo HS256 do access token (#7 verifica, #10 assina); distinto por ambiente (#92).
    JWT_ACCESS_SECRET: z.string().min(32, { error: 'obrigatória, com ao menos 32 caracteres' }),
    // Sentry da API (#48): ausente = desligado (local e testes).
    SENTRY_DSN: vaziaComoAusente(z.url({ error: 'deve ser uma URL' }).optional()),
    SENTRY_TRACES_SAMPLE_RATE: vaziaComoAusente(
      z.coerce.number({ error: 'deve ser um número de 0 a 1' }).min(0).max(1).default(0.1),
    ),
  })
  // Com NODE_ENV=production, APP_ENV é obrigatória: um deploy sem ela não pode subir como `local`.
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' || env.APP_ENV === 'homologacao' || env.APP_ENV === 'producao',
    { path: ['APP_ENV'], error: 'obrigatória com NODE_ENV=production (homologacao | producao)' },
  )
  .refine((env) => env.EMAIL_PROVIDER !== 'resend' || env.RESEND_API_KEY !== undefined, {
    path: ['RESEND_API_KEY'],
    error: 'obrigatória com EMAIL_PROVIDER=resend',
  })
  // Em homologação/produção o e-mail precisa sair de verdade: fake/log descartariam os códigos.
  .refine((env) => env.NODE_ENV !== 'production' || env.EMAIL_PROVIDER === 'resend', {
    path: ['EMAIL_PROVIDER'],
    error: 'deve ser resend com NODE_ENV=production',
  })
  .transform((env) => ({ ...env, APP_ENV: env.APP_ENV ?? 'local' }))

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
