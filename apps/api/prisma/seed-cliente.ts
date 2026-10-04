import { PrismaPg } from '@prisma/adapter-pg'
import { ClsServiceManager } from 'nestjs-cls'
import { PrismaClient } from '../src/generated/prisma/client'
import {
  ContextoAtletica,
  type StoreContexto,
} from '../src/infra/contexto/contexto-atletica.service'
import { extensaoAtletica } from '../src/infra/prisma/extensao-atletica'

/** Clientes dos scripts fora da API (seed da #45 e massa de carga da #83). */
export function criarClientesSeed(databaseUrl: string) {
  const semEscopo = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
  const contexto = new ContextoAtletica(ClsServiceManager.getClsService<StoreContexto>())
  return { semEscopo, contexto, db: semEscopo.$extends(extensaoAtletica(contexto)) }
}
