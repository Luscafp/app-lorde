import { S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import { AuthModule } from '../auth/auth.module'
import { ASSINAR_URL, criarClienteS3 } from './armazenamento'
import { UploadsController } from './uploads.controller'
import { UploadsService } from './uploads.service'

/** O `S3Client` e o presigner são providers para serem trocados por mocks nos testes. */
@Module({
  imports: [AuthModule],
  controllers: [UploadsController],
  providers: [
    {
      provide: S3Client,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        criarClienteS3({
          R2_ACCOUNT_ID: config.get('R2_ACCOUNT_ID', { infer: true }),
          R2_ACCESS_KEY_ID: config.get('R2_ACCESS_KEY_ID', { infer: true }),
          R2_SECRET_ACCESS_KEY: config.get('R2_SECRET_ACCESS_KEY', { infer: true }),
        }),
    },
    { provide: ASSINAR_URL, useValue: getSignedUrl },
    UploadsService,
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
