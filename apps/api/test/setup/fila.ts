import type { INestApplicationContext } from '@nestjs/common'
import { setTimeout as esperar } from 'node:timers/promises'
import { FilaService } from '../../src/infra/fila/fila.service'
import { prismaTeste } from './prisma-teste'

const ESPERA_PADRAO_MS = 15_000
const INTERVALO_MS = 50

export interface OpcoesEspera {
  esperaMs?: number
}

/**
 * Jobs que ainda vão rodar sem depender do relógio: ativos, em retry (inclusive no backoff) e
 * criados com `startAfter` vencido. Jobs agendados para o futuro e filas internas ficam de fora.
 */
async function contarPendentes(nome: string | null): Promise<number> {
  const [linha] = await prismaTeste.$queryRaw<{ total: number }[]>`
    SELECT count(*)::int AS total FROM pgboss.job
    WHERE (${nome}::text IS NULL OR name = ${nome})
      AND name NOT LIKE '\_\_pgboss\_\_%'
      AND (state IN ('active', 'retry') OR (state = 'created' AND start_after <= now()))`
  return linha?.total ?? 0
}

async function aguardar(
  app: INestApplicationContext,
  nome: string | null,
  { esperaMs = ESPERA_PADRAO_MS }: OpcoesEspera,
): Promise<void> {
  const fila = app.get(FilaService)
  const limite = Date.now() + esperaMs
  while ((await contarPendentes(nome)) > 0) {
    if (Date.now() > limite) {
      throw new Error(`Fila ${nome ?? '(todas)'} ainda com jobs pendentes após ${esperaMs} ms.`)
    }
    fila.acordarWorkers()
    await esperar(INTERVALO_MS)
  }
}

/** Espera os workers do pg-boss real esvaziarem a fila `nome` (convenções §9). */
export function aguardarFilaVazia(
  app: INestApplicationContext,
  nome: string,
  opcoes: OpcoesEspera = {},
): Promise<void> {
  return aguardar(app, nome, opcoes)
}

/** Espera todas as filas da aplicação ficarem sem jobs prontos para rodar. */
export function processarFilas(
  app: INestApplicationContext,
  opcoes: OpcoesEspera = {},
): Promise<void> {
  return aguardar(app, null, opcoes)
}
