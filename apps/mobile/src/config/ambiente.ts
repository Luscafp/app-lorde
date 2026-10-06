/** Nome de produção em `EXPO_PUBLIC_AMBIENTE` e nos canais OTA (convenções §11.11). */
export const AMBIENTE_PRODUCAO = 'producao'

/** Variáveis públicas embutidas no build (prefixo EXPO_PUBLIC_). */
export const ambiente = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
  nome: process.env.EXPO_PUBLIC_AMBIENTE ?? 'development',
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
} as const
