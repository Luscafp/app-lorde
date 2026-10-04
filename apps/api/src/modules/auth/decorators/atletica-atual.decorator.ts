import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { RequisicaoAutenticada } from '../tipos'

/** `atleticaId` do token. Em rota `@Publico()` é erro de programação (500). */
export const AtleticaAtual = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const { usuario } = ctx.switchToHttp().getRequest<RequisicaoAutenticada>()
  if (!usuario) throw new Error('@AtleticaAtual() usado em rota sem autenticação.')
  return usuario.atleticaId
})
