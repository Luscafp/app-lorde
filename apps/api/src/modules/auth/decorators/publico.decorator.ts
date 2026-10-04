import { applyDecorators, type ExecutionContext, SetMetadata } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { ApiExtension } from '@nestjs/swagger'

export const PUBLICO = 'auth:publico'
/** Marca a rota no Swagger; removida por `documentarAutenticacao`. */
export const EXTENSAO_PUBLICO = 'x-publico'

/** Libera a rota sem token e sem contexto de atlética. Exige justificativa no PR (issue #7 §10). */
export function Publico(): ClassDecorator & MethodDecorator {
  return applyDecorators(SetMetadata(PUBLICO, true), ApiExtension(EXTENSAO_PUBLICO, true))
}

export function ehRotaPublica(reflector: Reflector, ctx: ExecutionContext): boolean {
  return reflector.getAllAndOverride<boolean>(PUBLICO, [ctx.getHandler(), ctx.getClass()]) ?? false
}
