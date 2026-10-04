import type { LoggerService } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'

/** Limite do RNF03. */
export const LIMITE_CONSULTA_LENTA_MS = 500

interface Consulta {
  model?: string
  operation: string
  args: unknown
  query: (args: unknown) => Promise<unknown>
}

/** Mede a consulta; acima do limite, `warn` com modelo e operação, nunca os parâmetros. */
export function medirConsulta(
  logger: Pick<LoggerService, 'warn'>,
  relogio: () => number = () => performance.now(),
) {
  return async ({ model, operation, args, query }: Consulta): Promise<unknown> => {
    const inicio = relogio()
    try {
      return await query(args)
    } finally {
      const durationMs = Math.round(relogio() - inicio)
      if (durationMs > LIMITE_CONSULTA_LENTA_MS) {
        logger.warn({ model, operation, durationMs }, 'Consulta lenta')
      }
    }
  }
}

export function extensaoConsultasLentas(logger: Pick<LoggerService, 'warn'>) {
  return Prisma.defineExtension({
    name: 'consultas-lentas',
    query: { $allOperations: medirConsulta(logger) },
  })
}
