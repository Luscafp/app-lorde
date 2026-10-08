import { Global, Module } from '@nestjs/common'
import { FilaService } from './fila.service'

/** Único registro do pg-boss (dono: #86, convenções §11.6); as filas são criadas por quem as usa. */
@Global()
@Module({
  providers: [FilaService],
  exports: [FilaService],
})
export class FilaModule {}
