import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import { AuthModule } from '../auth/auth.module'
import { AvisosController } from './avisos/avisos.controller'
import { AvisosService } from './avisos/avisos.service'
import { DestinatariosService } from './destinatarios.service'
import { DispositivosController } from './dispositivos/dispositivos.controller'
import { DispositivosOuvinte } from './dispositivos/dispositivos.ouvinte'
import { DispositivosService } from './dispositivos/dispositivos.service'
import { ClienteExpoPush } from './envio/cliente-expo-push'
import { EntregaPushService } from './envio/entrega-push.service'
import { FakeExpoPush } from './envio/fake-expo-push'
import { SdkExpoPush } from './envio/sdk-expo-push'
import { GatilhosOuvinte } from './gatilhos/gatilhos.ouvinte'
import { GatilhosService } from './gatilhos/gatilhos.service'
import { LembretesOuvinte } from './lembretes/lembretes.ouvinte'
import { LembretesService } from './lembretes/lembretes.service'
import { NotificacoesService } from './notificacoes.service'
import { PreferenciasModule } from './preferencias/preferencias.module'

/** Dispositivos e envio push (#87), gatilhos (#89), lembretes (#90) e avisos da diretoria (#38). */
@Module({
  imports: [AuthModule, PreferenciasModule],
  controllers: [AvisosController, DispositivosController],
  providers: [
    AvisosService,
    {
      provide: ClienteExpoPush,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('NODE_ENV', { infer: true }) === 'test'
          ? new FakeExpoPush()
          : new SdkExpoPush(config.get('EXPO_ACCESS_TOKEN', { infer: true })),
    },
    DestinatariosService,
    DispositivosOuvinte,
    DispositivosService,
    EntregaPushService,
    GatilhosOuvinte,
    GatilhosService,
    LembretesOuvinte,
    LembretesService,
    NotificacoesService,
  ],
  exports: [DestinatariosService, NotificacoesService],
})
export class NotificacoesModule {}
