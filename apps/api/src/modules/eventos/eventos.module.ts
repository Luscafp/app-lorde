import { Module } from '@nestjs/common'
import { UploadsModule } from '../uploads/uploads.module'
import { EventosQueryService } from './eventos-query.service'
import { EventosController } from './eventos.controller'
import { EventosService } from './eventos.service'
import { EventosValidator } from './eventos.validator'

@Module({
  imports: [UploadsModule],
  controllers: [EventosController],
  providers: [EventosService, EventosQueryService, EventosValidator],
  exports: [EventosService],
})
export class EventosModule {}
