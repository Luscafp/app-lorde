export const StatusNoticia = {
  RASCUNHO: 'RASCUNHO',
  PUBLICADA: 'PUBLICADA',
} as const

export type StatusNoticia = (typeof StatusNoticia)[keyof typeof StatusNoticia]
