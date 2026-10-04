import { Global, Module } from '@nestjs/common'
import type { Request } from 'express'
import { ClsModule } from 'nestjs-cls'
import { ContextoAtletica, type StoreContexto } from './contexto-atletica.service'
import { vincularContexto } from './contexto-requisicao'

/** CLS por requisição (middleware montado em todas as rotas) e `ContextoAtletica`, globais. */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req: Request) => {
          cls.set('requestId', typeof req.id === 'string' ? req.id : undefined)
          vincularContexto(req, cls.get<StoreContexto>())
        },
      },
    }),
  ],
  providers: [ContextoAtletica],
  exports: [ContextoAtletica],
})
export class ContextoModule {}
