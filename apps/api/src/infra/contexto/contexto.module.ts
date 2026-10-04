import { Global, Module } from '@nestjs/common'
import { ClsModule } from 'nestjs-cls'
import { ContextoAtletica } from './contexto-atletica.service'

/** CLS por requisição (middleware montado em todas as rotas) e `ContextoAtletica`, globais. */
@Global()
@Module({
  imports: [ClsModule.forRoot({ global: true, middleware: { mount: true } })],
  providers: [ContextoAtletica],
  exports: [ContextoAtletica],
})
export class ContextoModule {}
