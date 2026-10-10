import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import { DestinatariosService } from './destinatarios.service'
import { DispositivosController } from './dispositivos/dispositivos.controller'
import { DispositivosOuvinte } from './dispositivos/dispositivos.ouvinte'
import { DispositivosService } from './dispositivos/dispositivos.service'
import { GatilhosOuvinte } from './gatilhos/gatilhos.ouvinte'
import { GatilhosService } from './gatilhos/gatilhos.service'
import { ClienteExpoPush } from './envio/cliente-expo-push'
import { EntregaPushService } from './envio/entrega-push.service'
import { FakeExpoPush } from './envio/fake-expo-push'
import { SdkExpoPush } from './envio/sdk-expo-push'
import { NotificacoesService } from './notificacoes.service'
import { PreferenciasModule } from './preferencias/preferencias.module'

/** Dispositivos e envio push (#87), gatilhos imediatos (#89); exporta o contrato de #90 e #38. */
@Module({
  imports: [PreferenciasModule],
  controllers: [DispositivosController],
  providers: [
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
    NotificacoesService,
  ],
  exports: [DestinatariosService, NotificacoesService],
})
export class NotificacoesModule {}
