import { Module } from '@nestjs/common'
import { UploadsModule } from '../uploads/uploads.module'
import { ElencoController } from './elenco.controller'
import { ElencoService } from './elenco.service'
import { TimesController } from './times.controller'
import { TimesService } from './times.service'

@Module({
  imports: [UploadsModule],
  controllers: [TimesController, ElencoController],
  providers: [TimesService, ElencoService],
  exports: [TimesService, ElencoService],
})
export class TimesModule {}
