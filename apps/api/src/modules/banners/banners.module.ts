import { Module } from '@nestjs/common'
import { UploadsModule } from '../uploads/uploads.module'
import { BannersPainelController } from './banners-painel.controller'
import { BannersPublicosController } from './banners-publicos.controller'
import { BannersService } from './banners.service'

/** Carrossel da Home (`/banners`) e gestão pelo Painel (`/painel/banners`). */
@Module({
  imports: [UploadsModule],
  controllers: [BannersPublicosController, BannersPainelController],
  providers: [BannersService],
})
export class BannersModule {}
