import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3'
import type { TestingModuleBuilder } from '@nestjs/testing'
import { ASSINAR_URL, type AssinarUrl } from '../../src/modules/uploads/armazenamento'

export const URL_ASSINADA_FICTICIA = 'https://r2.teste.local/assinada?X-Amz-Expires=300'

export interface ArmazenamentoSimulado {
  /** `send` do `S3Client`: por padrão, `HeadObject` de um JPEG de 800 kB. */
  s3: { send: jest.Mock }
  assinar: jest.Mock<ReturnType<AssinarUrl>, Parameters<AssinarUrl>>
  /** Para `criarApp({ ajustar })`. */
  ajustar: (modulo: TestingModuleBuilder) => TestingModuleBuilder
}

/** R2 mockado (convenções §9): nenhum teste da CI fala com o R2 real. */
export function simularArmazenamento(): ArmazenamentoSimulado {
  const s3 = {
    send: jest.fn().mockResolvedValue({ ContentLength: 800_000, ContentType: 'image/jpeg' }),
  }
  const assinar = jest.fn<ReturnType<AssinarUrl>, Parameters<AssinarUrl>>()
  assinar.mockResolvedValue(URL_ASSINADA_FICTICIA)
  return {
    s3,
    assinar,
    ajustar: (modulo) =>
      modulo
        .overrideProvider(S3Client)
        .useValue(s3)
        .overrideProvider(ASSINAR_URL)
        .useValue(assinar),
  }
}

/** Comandos de um tipo enviados ao `S3Client` simulado. */
export function comandosEnviados<T>(send: jest.Mock, tipo: new (...args: never[]) => T): T[] {
  return send.mock.calls
    .map(([comando]: [unknown]) => comando)
    .filter((comando): comando is T => comando instanceof tipo)
}

export function chavesApagadas(send: jest.Mock): (string | undefined)[] {
  return comandosEnviados(send, DeleteObjectsCommand).flatMap(({ input }) =>
    (input.Delete?.Objects ?? []).map(({ Key }) => Key),
  )
}
