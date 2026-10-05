import { Module } from '@nestjs/common'
import { SenhaModule } from '../../infra/senha/senha.module'
import { AuthModule } from '../auth/auth.module'
import { UploadsModule } from '../uploads/uploads.module'
import { CargosService } from './cargos.service'
import { GestaoUsuariosService } from './gestao-usuarios.service'
import { MeController } from './me.controller'
import { PerfilService } from './perfil.service'
import { UsuariosController } from './usuarios.controller'

@Module({
  imports: [AuthModule, UploadsModule, SenhaModule],
  controllers: [MeController, UsuariosController],
  providers: [GestaoUsuariosService, PerfilService, CargosService],
  exports: [GestaoUsuariosService],
})
export class UsuariosModule {}
