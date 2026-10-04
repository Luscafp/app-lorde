import { applyDecorators, SetMetadata } from '@nestjs/common'
import { ApiExtension } from '@nestjs/swagger'

export const PUBLICO = 'auth:publico'
/** Marca a rota no Swagger; removida por `documentarAutenticacao`. */
export const EXTENSAO_PUBLICO = 'x-publico'

/** Libera a rota sem token e sem contexto de atlética. Exige justificativa no PR (issue #7 §10). */
export function Publico(): ClassDecorator & MethodDecorator {
  return applyDecorators(SetMetadata(PUBLICO, true), ApiExtension(EXTENSAO_PUBLICO, true))
}
