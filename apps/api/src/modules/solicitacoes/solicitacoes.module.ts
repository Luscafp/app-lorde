import { Module } from '@nestjs/common'
import { UploadsModule } from '../uploads/uploads.module'
import { SolicitacoesPainelController } from './solicitacoes-painel.controller'
import { SolicitacoesPainelService } from './solicitacoes-painel.service'
import { SolicitacoesController } from './solicitacoes.controller'
import { SolicitacoesService } from './solicitacoes.service'

@Module({
  imports: [UploadsModule],
  controllers: [SolicitacoesController, SolicitacoesPainelController],
  providers: [SolicitacoesService, SolicitacoesPainelService],
  exports: [SolicitacoesService],
})
export class SolicitacoesModule {}
