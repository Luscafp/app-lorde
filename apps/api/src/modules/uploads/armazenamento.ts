import { type PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Env } from '../../config/env.schema'

/** Token do presigner (`getSignedUrl`), injetável para ser trocado por um mock nos testes. */
export const ASSINAR_URL = Symbol('ASSINAR_URL')
export type AssinarUrl = (
  cliente: S3Client,
  comando: PutObjectCommand,
  opcoes: NonNullable<Parameters<typeof getSignedUrl>[2]>,
) => Promise<string>

type EnvR2 = Pick<Env, 'R2_ACCOUNT_ID' | 'R2_ACCESS_KEY_ID' | 'R2_SECRET_ACCESS_KEY'>

/** Cliente S3 do R2 (URLs `<endpoint>/<bucket>/<key>`); checksum só quando exigido pelo R2. */
export function criarClienteS3(env: EnvR2): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}
