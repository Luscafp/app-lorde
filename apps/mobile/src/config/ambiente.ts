/** Variáveis públicas embutidas no build (prefixo EXPO_PUBLIC_). */
export const ambiente = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
  nome: process.env.EXPO_PUBLIC_AMBIENTE ?? 'development',
} as const
