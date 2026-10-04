import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { Logger } from 'nestjs-pino'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import type { Env } from './config/env.schema'
import { requestIdMiddleware } from './infra/logs/request-id.middleware'
import { documentarAutenticacao } from './modules/auth/swagger'

export const PREFIXO_API = 'api/v1'
export const ROTA_DOCS = 'api/docs'
/** Imagens não passam pela API (#9); corpos maiores respondem 413. */
export const LIMITE_CORPO = '100kb'
/** Só o proxy da Railway é confiável: `req.ip` é o último IP do `X-Forwarded-For`, não forjável. */
export const SALTOS_PROXY_CONFIAVEIS = 1

/**
 * Configuração comum da aplicação, usada pelo `main.ts` e pelos testes de integração.
 * A aplicação deve ser criada com `bodyParser: false`.
 */
export function configurarApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService)

  app.set('trust proxy', SALTOS_PROXY_CONFIAVEIS)
  app.use(requestIdMiddleware)
  app.useLogger(app.get(Logger))
  app.setGlobalPrefix(PREFIXO_API)
  app.enableShutdownHooks()
  app.use(helmet())
  app.useBodyParser('json', { limit: LIMITE_CORPO })
  app.useBodyParser('urlencoded', { limit: LIMITE_CORPO, extended: true })

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('API Atlética').setVersion('1.0').addBearerAuth().build(),
    )
    SwaggerModule.setup(ROTA_DOCS, app, cleanupOpenApiDoc(documentarAutenticacao(documento)))
  }
}
