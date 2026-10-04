import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { PARAMS_PROVIDER_TOKEN } from 'nestjs-pino'
import { validarEnv, type Env } from '../../src/config/env.schema'
import { criarConfigLogger } from '../../src/infra/logs/logger.config'
import { criarApp } from '../setup/criar-app'
import { ExemploController } from './exemplo.controller'

/** Recebe as linhas JSON escritas pelo pino, para inspecionar o log nos testes. */
function destinoDeLog(linhas: Record<string, unknown>[]) {
  return { write: (linha: string) => linhas.push(JSON.parse(linha) as Record<string, unknown>) }
}

export async function criarAppPlataforma(
  env: Partial<Env> = {},
  linhasDeLog?: Record<string, unknown>[],
): Promise<NestExpressApplication> {
  const config = { ...validarEnv(process.env), ...env }
  const { app } = await criarApp({
    controllers: [ExemploController],
    ajustar: (modulo) => {
      const ajustado = modulo
        .overrideProvider(ConfigService)
        .useValue({ get: (chave: keyof Env) => config[chave] })
      if (!linhasDeLog) return ajustado
      const params = criarConfigLogger({
        NODE_ENV: 'test',
        LOG_LEVEL: env.LOG_LEVEL ?? 'warn',
        APP_ENV: 'local',
      })
      return ajustado
        .overrideProvider(PARAMS_PROVIDER_TOKEN)
        .useValue({ ...params, pinoHttp: [params.pinoHttp, destinoDeLog(linhasDeLog)] })
    },
  })
  return app
}
