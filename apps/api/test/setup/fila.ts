import type { INestApplicationContext } from '@nestjs/common'
import { setTimeout as esperar } from 'node:timers/promises'
import { FilaService } from '../../src/infra/fila/fila.service'
import { prismaTeste } from './prisma-teste'

const ESPERA_PADRAO_MS = 15_000
const INTERVALO_MS = 50

export interface OpcoesEspera {
  esperaMs?: number
}

/** Ativos, em retry e criados com `startAfter` vencido; jobs futuros e filas internas ficam de fora. */
async function contarPendentes(nome: string | null): Promise<number> {
  const [linha] = await prismaTeste.$queryRaw<{ total: number }[]>`
    SELECT count(*)::int AS total FROM pgboss.job
    WHERE (${nome}::text IS NULL OR name = ${nome})
      AND name NOT LIKE '\_\_pgboss\_\_%'
      AND (state IN ('active', 'retry') OR (state = 'created' AND start_after <= now()))`
  return linha?.total ?? 0
}

export async function aguardarCondicao(
  condicao: () => Promise<boolean> | boolean,
  { esperaMs = ESPERA_PADRAO_MS }: OpcoesEspera = {},
): Promise<void> {
  const limite = Date.now() + esperaMs
  while (!(await condicao())) {
    if (Date.now() > limite) throw new Error(`Condição não atingida após ${esperaMs} ms.`)
    await esperar(INTERVALO_MS)
  }
}

function aguardar(
  app: INestApplicationContext,
  nome: string | null,
  opcoes: OpcoesEspera,
): Promise<void> {
  const fila = app.get(FilaService)
  return aguardarCondicao(async () => {
    fila.acordarWorkers()
    return (await contarPendentes(nome)) === 0
  }, opcoes)
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
