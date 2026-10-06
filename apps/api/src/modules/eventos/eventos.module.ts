import { Module } from '@nestjs/common'
import { EventosController } from './eventos.controller'
import { EventosService } from './eventos.service'
import { EventosValidator } from './eventos.validator'

@Module({
  controllers: [EventosController],
  providers: [EventosService, EventosValidator],
  exports: [EventosService],
})
export class EventosModule {}
