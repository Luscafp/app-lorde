import type { Papel } from '@atletica/shared'
import { applyDecorators, SetMetadata } from '@nestjs/common'
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger'

export const PAPEL_MINIMO = 'auth:papel-minimo'

/** Nível mínimo da rota; a hierarquia (`temNivelMinimo`) libera os papéis acima. */
export function PapelMinimo(papel: Papel): ClassDecorator & MethodDecorator {
  return applyDecorators(
    SetMetadata(PAPEL_MINIMO, papel),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Sessão inválida, expirada ou conta desativada.' }),
    ApiForbiddenResponse({ description: `Exige papel ${papel} ou superior.` }),
  )
}
