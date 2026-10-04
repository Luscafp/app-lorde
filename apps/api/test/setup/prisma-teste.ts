import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma/client'

/**
 * Cliente Prisma **base** dos testes (sem a extensão multi-atlética da #44): enxerga todas as
 * atléticas e não exige contexto. Usado por `limparBanco`, pelas fábricas e para conferir o banco
 * nos testes. Um por arquivo de teste; desconectado no `afterAll` (test/setup/integracao.ts).
 */
export const prismaTeste = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})
