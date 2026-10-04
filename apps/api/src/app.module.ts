import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'
import { ZodValidationPipe } from 'nestjs-zod'
import { ExcecaoGlobalFilter } from './common/filtros/excecao-global.filter'
import { ConfiguracaoModule } from './config/config.module'
import type { Env } from './config/env.schema'
import { ContextoModule } from './infra/contexto/contexto.module'
import { EventosModule } from './infra/eventos/eventos.module'
import { criarConfigLogger } from './infra/logs/logger.config'
import { PrismaModule } from './infra/prisma/prisma.module'
import { AuditoriaModule } from './modules/auditoria/auditoria.module'
import { AuthModule } from './modules/auth/auth.module'
import { DiagnosticoForaDeProducao } from './modules/diagnostico/diagnostico.module'

@Module({
  imports: [
    ConfiguracaoModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        criarConfigLogger({
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }),
          APP_ENV: config.get('APP_ENV', { infer: true }),
        }),
    }),
    ContextoModule,
    PrismaModule,
    EventosModule,
    AuditoriaModule,
    AuthModule,
    DiagnosticoForaDeProducao,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ExcecaoGlobalFilter },
  ],
})
export class AppModule {}
