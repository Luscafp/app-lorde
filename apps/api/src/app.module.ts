import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'
import { ZodValidationPipe } from 'nestjs-zod'
import { ExcecaoGlobalFilter } from './common/filtros/excecao-global.filter'
import { ConfiguracaoModule } from './config/config.module'
import type { Env } from './config/env.schema'
import { AgendadorModule } from './infra/agendador/agendador.module'
import { ContextoModule } from './infra/contexto/contexto.module'
import { EventosDominioModule } from './infra/eventos/eventos.module'
import { FilaModule } from './infra/fila/fila.module'
import { criarConfigLogger } from './infra/logs/logger.config'
import { PrismaModule } from './infra/prisma/prisma.module'
import { AtleticasAdversariasModule } from './modules/atleticas/atleticas-adversarias.module'
import { AtleticasModule } from './modules/atleticas/atleticas.module'
import { AuditoriaModule } from './modules/auditoria/auditoria.module'
import { AuthModule } from './modules/auth/auth.module'
import { BannersModule } from './modules/banners/banners.module'
import { DiagnosticoForaDeProducao } from './modules/diagnostico/diagnostico.module'
import { EventosModule } from './modules/eventos/eventos.module'
import { HealthModule } from './modules/health/health.module'
import { ModalidadesModule } from './modules/modalidades/modalidades.module'
import { NoticiasModule } from './modules/noticias/noticias.module'
import { NotificacoesModule } from './modules/notificacoes/notificacoes.module'
import { ParticipacoesModule } from './modules/participacoes/participacoes.module'
import { TimesModule } from './modules/times/times.module'
import { UploadsModule } from './modules/uploads/uploads.module'
import { UsuariosModule } from './modules/usuarios/usuarios.module'

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
          GIT_COMMIT_SHA: config.get('GIT_COMMIT_SHA', { infer: true }),
          RAILWAY_GIT_COMMIT_SHA: config.get('RAILWAY_GIT_COMMIT_SHA', { infer: true }),
        }),
    }),
    ContextoModule,
    PrismaModule,
    EventosDominioModule,
    FilaModule,
    AgendadorModule,
    AuditoriaModule,
    AuthModule,
    BannersModule,
    AtleticasModule,
    AtleticasAdversariasModule,
    EventosModule,
    HealthModule,
    ModalidadesModule,
    NoticiasModule,
    NotificacoesModule,
    ParticipacoesModule,
    TimesModule,
    UploadsModule,
    UsuariosModule,
    DiagnosticoForaDeProducao,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ExcecaoGlobalFilter },
  ],
})
export class AppModule {}
