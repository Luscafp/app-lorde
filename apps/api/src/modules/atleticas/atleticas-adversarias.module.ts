import { Module } from '@nestjs/common'
import { AtleticasAdversariasController } from './atleticas-adversarias.controller'
import { AtleticasAdversariasService } from './atleticas-adversarias.service'

@Module({
  controllers: [AtleticasAdversariasController],
  providers: [AtleticasAdversariasService],
})
export class AtleticasAdversariasModule {}
