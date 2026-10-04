// Variáveis públicas do app (.env.example). Sem esta declaração, o índice `any` do
// expo-modules-core tiparia qualquer process.env.X como any.
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string
    EXPO_PUBLIC_AMBIENTE?: string
  }
}
