import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { UploadsModule } from '../uploads/uploads.module'
import { CargosService } from './cargos.service'
import { GestaoUsuariosService } from './gestao-usuarios.service'
import { UsuariosController } from './usuarios.controller'

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [UsuariosController],
  providers: [GestaoUsuariosService, CargosService],
  exports: [GestaoUsuariosService],
})
export class UsuariosModule {}
