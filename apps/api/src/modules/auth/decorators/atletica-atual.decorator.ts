import { createParamDecorator } from '@nestjs/common'
import { ClsServiceManager } from 'nestjs-cls'
import type { StoreContexto } from '../../../infra/contexto/contexto-atletica.service'

/** `atleticaId` do contexto da requisição. Em rota `@Publico()` é erro de programação (500). */
export const AtleticaAtual = createParamDecorator((): string => {
  const atleticaId = ClsServiceManager.getClsService<StoreContexto>().get('atleticaId')
  if (!atleticaId) throw new Error('@AtleticaAtual() usado em rota sem autenticação.')
  return atleticaId
})
