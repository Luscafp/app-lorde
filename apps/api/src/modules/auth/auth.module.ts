import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import type { Env } from '../../config/env.schema'
import { EmailModule } from '../../infra/email/email.module'
import { SenhaModule } from '../../infra/senha/senha.module'
import { AtleticasModule } from '../atleticas/atleticas.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { PapelGuard } from './guards/papel.guard'
import { RateLimitService } from './rate-limit.service'
import { RecuperacaoSenhaService } from './recuperacao-senha.service'
import { RespostaSessaoService } from './resposta-sessao.service'
import { SessaoService } from './sessao.service'
import { TokenAcessoService } from './token-acesso.service'
import { VerificacaoEmailController } from './verificacao-email/verificacao-email.controller'
import { VerificacaoEmailOuvinte } from './verificacao-email/verificacao-email.ouvinte'
import { VerificacaoEmailService } from './verificacao-email/verificacao-email.service'

/** Guards globais na ordem `JwtAuthGuard` → `PapelGuard`. */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
      }),
    }),
    SenhaModule,
    EmailModule,
    AtleticasModule,
  ],
  controllers: [AuthController, VerificacaoEmailController],
  providers: [
    TokenAcessoService,
    RateLimitService,
    SessaoService,
    RespostaSessaoService,
    AuthService,
    RecuperacaoSenhaService,
    VerificacaoEmailService,
    VerificacaoEmailOuvinte,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PapelGuard },
  ],
  exports: [TokenAcessoService, RateLimitService, SessaoService, RespostaSessaoService],
})
export class AuthModule {}
