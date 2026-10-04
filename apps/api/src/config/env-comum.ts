import { z } from 'zod'

/** Partes de validação de env compartilhadas pela API e pelo seed. */

// O dotenv lê `VAR=` como '': vazia conta como ausente.
export function vazioComoAusente<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
    schema,
  )
}

export const appEnvSchema = z.enum(['local', 'development', 'homologacao', 'producao'])

export const databaseUrlSchema = z.url({
  protocol: /^postgres(ql)?$/,
  error: 'obrigatória, no formato postgresql://',
})

// Com NODE_ENV=production, APP_ENV é obrigatória: um deploy sem ela não pode rodar como `local`.
export const appEnvExigidaEmProducao: [
  (env: { NODE_ENV?: string; APP_ENV?: string }) => boolean,
  { path: string[]; error: string },
] = [
  (env) =>
    env.NODE_ENV !== 'production' || env.APP_ENV === 'homologacao' || env.APP_ENV === 'producao',
  { path: ['APP_ENV'], error: 'obrigatória com NODE_ENV=production (homologacao | producao)' },
]

/** Uma linha por variável inválida, nunca com o valor. */
export function listarVariaveisInvalidas(
  erro: z.ZodError,
  dicas: Record<string, string> = {},
): string {
  return erro.issues
    .map((issue) => {
      const campo = issue.path.join('.')
      const dica = dicas[campo] ? ` (${dicas[campo]})` : ''
      return `  - ${campo}: ${issue.message}${dica}`
    })
    .join('\n')
}
