import type { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import type { ContextoAtletica } from '../contexto/contexto-atletica.service'
import { FilaService } from './fila.service'

function filaSemWorkers(): FilaService {
  const valores = {
    DATABASE_URL: 'postgresql://ninguem:nada@127.0.0.1:1/inexistente',
    FILA_WORKERS_ATIVOS: false,
  }
  const config = {
    get: (chave: keyof typeof valores) => valores[chave],
  } as unknown as ConfigService<Env, true>
  return new FilaService(config, {} as ContextoAtletica)
}

describe('FilaService com FILA_WORKERS_ATIVOS=false', () => {
  it('sobe, ignora workers e crons e encerra sem conectar ao banco', async () => {
    const fila = filaSemWorkers()

    await fila.onModuleInit()
    await fila.trabalhar('teste.fila' as never, jest.fn())
    await fila.agendar('teste.fila' as never, '0 4 * * *')
    await fila.onModuleDestroy()
  })
})
