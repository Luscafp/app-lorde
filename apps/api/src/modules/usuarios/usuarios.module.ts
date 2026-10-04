import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { UploadsModule } from '../uploads/uploads.module'
import { GestaoUsuariosService } from './gestao-usuarios.service'
import { UsuariosController } from './usuarios.controller'

/** As regras de papel (#12, #28) são funções de `regras-papel.ts`, importadas direto. */
@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [UsuariosController],
  providers: [GestaoUsuariosService],
  exports: [GestaoUsuariosService],
})
export class UsuariosModule {}
