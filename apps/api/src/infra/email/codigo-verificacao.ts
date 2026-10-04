import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'

/** Quantidade de dígitos do código enviado por e-mail (UC09). */
export const DIGITOS_CODIGO = 6

/** Código numérico de 6 dígitos (`000000`–`999999`), com zeros à esquerda. */
export function gerarCodigo(): string {
  return randomInt(0, 10 ** DIGITOS_CODIGO)
    .toString()
    .padStart(DIGITOS_CODIGO, '0')
}

/**
 * Códigos de verificação de e-mail (recuperação de senha #62, verificação de e-mail #31).
 * No banco vai só o hash: `HMAC-SHA256(CODIGO_PEPPER, usuarioId + ":" + codigo)` em hex — com
 * 10⁶ combinações, um SHA-256 puro seria revertido em segundos se o banco vazasse (épico #11 §10).
 * O código nunca vai para log, URL, resposta ou Sentry.
 */
@Injectable()
export class CodigoVerificacaoService {
  private readonly pepper: string

  constructor(config: ConfigService<Env, true>) {
    this.pepper = config.get('CODIGO_PEPPER', { infer: true })
  }

  gerarCodigo(): string {
    return gerarCodigo()
  }

  hashCodigo(usuarioId: string, codigo: string): string {
    return createHmac('sha256', this.pepper).update(`${usuarioId}:${codigo}`).digest('hex')
  }

  /** Compara em tempo constante; hash malformado conta como divergente. */
  codigoConfere(hash: string, usuarioId: string, codigo: string): boolean {
    const esperado = Buffer.from(this.hashCodigo(usuarioId, codigo), 'hex')
    const recebido = Buffer.from(hash, 'hex')
    return recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
  }
}
