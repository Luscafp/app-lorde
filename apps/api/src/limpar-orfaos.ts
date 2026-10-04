import './instrument'
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { LimpezaOrfaosService } from './modules/uploads/limpeza-orfaos.service'

/** Execução manual da limpeza de órfãos (#56): `pnpm --filter api uploads:limpar-orfaos`. */
async function executar(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))
  try {
    await app.get(LimpezaOrfaosService).executar()
  } finally {
    await app.close()
  }
}

executar().catch((erro: unknown) => {
  process.stderr.write(
    `Falha na limpeza de órfãos: ${String(erro instanceof Error ? erro.stack : erro)}\n`,
  )
  process.exit(1)
})
