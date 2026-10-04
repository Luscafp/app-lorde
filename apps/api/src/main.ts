import 'reflect-metadata'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { ErroConfiguracao, type Env } from './config/env.schema'
import { configurarApp, PREFIXO_API } from './configurar-app'

async function bootstrap(): Promise<void> {
  // Env inválida rejeita o ConfigModule.forRoot (assíncrono) e cai no catch abaixo.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
    abortOnError: false,
  })
  configurarApp(app)

  const porta = app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true })
  await app.listen(porta)
  app.get(Logger).log(`API ouvindo em http://localhost:${porta}/${PREFIXO_API}`, 'Bootstrap')
}

bootstrap().catch((erro: unknown) => {
  const texto =
    erro instanceof ErroConfiguracao ? erro.message : erro instanceof Error ? erro.stack : erro
  process.stderr.write(`Falha ao iniciar a API: ${String(texto)}\n`)
  process.exit(1)
})
