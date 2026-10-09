import { Global, Module } from '@nestjs/common'
import { AuditoriaConsultaService } from './auditoria-consulta.service'
import { AuditoriaController } from './auditoria.controller'
import { AuditoriaService } from './auditoria.service'
import { ReferenciasAuditoria } from './referencias'

@Global()
@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService, AuditoriaConsultaService, ReferenciasAuditoria],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
