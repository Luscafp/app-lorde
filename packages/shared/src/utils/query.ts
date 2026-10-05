import { z } from 'zod'

/** Booleano de query string (`true`/`false`), `false` quando ausente. */
export const booleanoQuerySchema = z
  .enum(['true', 'false'], { error: 'Use true ou false.' })
  .default('false')
  .transform((valor) => valor === 'true')
