import { Module } from '@nestjs/common'
import { UploadsModule } from '../uploads/uploads.module'
import { NoticiasPainelController } from './noticias-painel.controller'
import { NoticiasPainelService } from './noticias-painel.service'
import { NoticiasPublicasController } from './noticias-publicas.controller'
import { NoticiasPublicasService } from './noticias-publicas.service'
import { TagsController } from './tags.controller'
import { TagsService } from './tags.service'

/** Leitura pública (#78), gestão pelo Painel (#80) e tags (#32). */
@Module({
  imports: [UploadsModule],
  controllers: [NoticiasPublicasController, NoticiasPainelController, TagsController],
  providers: [NoticiasPublicasService, NoticiasPainelService, TagsService],
})
export class NoticiasModule {}
