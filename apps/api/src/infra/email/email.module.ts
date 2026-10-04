import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import { CodigoVerificacaoService } from './codigo-verificacao'
import { criarEmailProvider } from './criar-email-provider'
import { EmailProvider } from './email-provider'
import { EmailService } from './email.service'

/** E-mail transacional e códigos de verificação (dono: #61; usado pela #62 e #31). */
@Module({
  providers: [
    {
      provide: EmailProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        criarEmailProvider({
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          EMAIL_PROVIDER: config.get('EMAIL_PROVIDER', { infer: true }),
          RESEND_API_KEY: config.get('RESEND_API_KEY', { infer: true }),
        }),
    },
    EmailService,
    CodigoVerificacaoService,
  ],
  exports: [EmailProvider, EmailService, CodigoVerificacaoService],
})
export class EmailModule {}
