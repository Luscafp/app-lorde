import { Module } from '@nestjs/common'
import { UploadsModule } from '../uploads/uploads.module'
import { NoticiasPublicasController } from './noticias-publicas.controller'
import { NoticiasPublicasService } from './noticias-publicas.service'

/** Dono: #78; a #80 registra aqui o controller do Painel. */
@Module({
  imports: [UploadsModule],
  controllers: [NoticiasPublicasController],
  providers: [NoticiasPublicasService],
})
export class NoticiasModule {}
