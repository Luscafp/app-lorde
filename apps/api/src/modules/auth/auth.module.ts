import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import type { Env } from '../../config/env.schema'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { PapelGuard } from './guards/papel.guard'
import { TokenAcessoService } from './token-acesso.service'

/** Guards globais na ordem `JwtAuthGuard` → `PapelGuard`. */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
      }),
    }),
  ],
  providers: [
    TokenAcessoService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PapelGuard },
  ],
  exports: [TokenAcessoService],
})
export class AuthModule {}
