import type { Type } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test, type TestingModuleBuilder } from '@nestjs/testing'
import type { App } from 'supertest/types'
import { AppModule } from '../../src/app.module'
import { configurarApp } from '../../src/configurar-app'

export interface OpcoesCriarApp {
  /** Controllers extras, só de teste (ex.: test/suporte/exemplo.controller.ts). */
  controllers?: Type[]
  /** Ajustes no módulo antes de compilar (`overrideProvider`, `overrideGuard`...). */
  ajustar?: (modulo: TestingModuleBuilder) => TestingModuleBuilder
}

export interface AppDeTeste {
  app: NestExpressApplication
  /** Servidor HTTP para o Supertest: `request(http).get('/api/v1/...')`. */
  http: App
}

/**
 * Sobe o `AppModule` real com a mesma configuração do `main.ts` (`configurarApp`: prefixo
 * `api/v1`, helmet, limite de corpo, Swagger) — o filtro global e o `ZodValidationPipe` vêm do
 * próprio `AppModule`. Feche no `afterAll` com `await app.close()`.
 */
export async function criarApp(opcoes: OpcoesCriarApp = {}): Promise<AppDeTeste> {
  const construtor = Test.createTestingModule({
    imports: [AppModule],
    controllers: opcoes.controllers ?? [],
  })
  const modulo = await (opcoes.ajustar?.(construtor) ?? construtor).compile()

  const app = modulo.createNestApplication<NestExpressApplication>({ bodyParser: false })
  configurarApp(app)
  await app.init()
  return { app, http: app.getHttpServer() }
}
