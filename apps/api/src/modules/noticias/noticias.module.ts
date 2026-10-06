import { Module } from '@nestjs/common'
import { UploadsModule } from '../uploads/uploads.module'
import { NoticiasPainelController } from './noticias-painel.controller'
import { NoticiasPainelService } from './noticias-painel.service'
import { NoticiasPublicasController } from './noticias-publicas.controller'
import { NoticiasPublicasService } from './noticias-publicas.service'

/** Leitura pública (#78) e gestão pelo Painel (#80). */
@Module({
  imports: [UploadsModule],
  controllers: [NoticiasPublicasController, NoticiasPainelController],
  providers: [NoticiasPublicasService, NoticiasPainelService],
})
export class NoticiasModule {}
