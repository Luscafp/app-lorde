import { Module } from '@nestjs/common'
import { AtleticaPadraoService } from './atletica-padrao.service'
import { AtleticasController } from './atleticas.controller'

@Module({
  controllers: [AtleticasController],
  providers: [AtleticaPadraoService],
  exports: [AtleticaPadraoService],
})
export class AtleticasModule {}
