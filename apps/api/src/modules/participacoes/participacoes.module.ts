import { Module } from '@nestjs/common'
import { EventosModule } from '../eventos/eventos.module'
import { UploadsModule } from '../uploads/uploads.module'
import { EstatisticasService } from './estatisticas.service'
import { ParticipacoesController } from './participacoes.controller'
import { ParticipacoesService } from './participacoes.service'
import { PresencasController } from './presencas.controller'
import { PresencasService } from './presencas.service'

@Module({
  imports: [EventosModule, UploadsModule],
  controllers: [ParticipacoesController, PresencasController],
  providers: [ParticipacoesService, PresencasService, EstatisticasService],
  exports: [EstatisticasService],
})
export class ParticipacoesModule {}
