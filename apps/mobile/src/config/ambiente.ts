/** Valores de `EXPO_PUBLIC_AMBIENTE`, do `environment` do Sentry e dos canais OTA (convenções §11.11). */
export const AMBIENTES = ['development', 'homologacao', 'producao'] as const
export type Ambiente = (typeof AMBIENTES)[number]
export const AMBIENTE_PRODUCAO: Ambiente = 'producao'

/** Variáveis públicas embutidas no build (prefixo EXPO_PUBLIC_), validadas no `app.config.ts`. */
export const ambiente = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
  nome: (process.env.EXPO_PUBLIC_AMBIENTE ?? 'development') as Ambiente,
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
} as const
