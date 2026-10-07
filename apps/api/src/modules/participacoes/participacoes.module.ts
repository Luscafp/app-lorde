import { Module } from '@nestjs/common'
import { EventosModule } from '../eventos/eventos.module'
import { ParticipacoesController } from './participacoes.controller'
import { ParticipacoesService } from './participacoes.service'

@Module({
  imports: [EventosModule],
  controllers: [ParticipacoesController],
  providers: [ParticipacoesService],
})
export class ParticipacoesModule {}
