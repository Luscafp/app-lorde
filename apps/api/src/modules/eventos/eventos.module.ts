import { Module } from '@nestjs/common'
import { EventosStatusService } from './eventos-status.service'
import { EventosController } from './eventos.controller'
import { EventosService } from './eventos.service'
import { EventosValidator } from './eventos.validator'
import { ResultadoService } from './resultado.service'

@Module({
  controllers: [EventosController],
  providers: [EventosService, EventosValidator, EventosStatusService, ResultadoService],
  exports: [EventosService],
})
export class EventosModule {}
