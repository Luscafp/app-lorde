import { Module } from '@nestjs/common'
import { UploadsModule } from '../uploads/uploads.module'
import { EventosLeituraService } from './eventos-leitura.service'
import { EventosStatusService } from './eventos-status.service'
import { EventosController } from './eventos.controller'
import { EventosService } from './eventos.service'
import { EventosValidator } from './eventos.validator'
import { ResultadoService } from './resultado.service'

@Module({
  imports: [UploadsModule],
  controllers: [EventosController],
  providers: [
    EventosService,
    EventosLeituraService,
    EventosValidator,
    EventosStatusService,
    ResultadoService,
  ],
  exports: [EventosService, EventosLeituraService],
})
export class EventosModule {}
