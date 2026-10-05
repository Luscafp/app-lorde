import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { UploadsModule } from '../uploads/uploads.module'
import { GestaoUsuariosService } from './gestao-usuarios.service'
import { UsuariosController } from './usuarios.controller'

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [UsuariosController],
  providers: [GestaoUsuariosService],
  exports: [GestaoUsuariosService],
})
export class UsuariosModule {}
