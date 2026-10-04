import { Global, Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { TransacaoService } from './apos-commit'
import { EventosDominioService } from './eventos-dominio.service'

/** Único registro do `EventEmitterModule` (dono: #8, convenções §11.6). */
@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [TransacaoService, EventosDominioService],
  exports: [TransacaoService, EventosDominioService],
})
export class EventosModule {}
