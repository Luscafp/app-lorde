import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { LimpezaDiariaJob } from './limpeza-diaria.job'

/** Único registro do `ScheduleModule` (dono: #58, convenções §11.6); jobs de outros módulos usam `@Cron`. */
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [LimpezaDiariaJob],
})
export class AgendadorModule {}
