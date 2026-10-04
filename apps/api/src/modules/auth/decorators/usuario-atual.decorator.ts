import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { RequisicaoAutenticada, UsuarioAutenticado } from '../tipos'

/** `UsuarioAutenticado` da requisição, ou um campo dele. `undefined` em rota `@Publico()`. */
export const UsuarioAtual = createParamDecorator(
  (campo: keyof UsuarioAutenticado | undefined, ctx: ExecutionContext) => {
    const { usuario } = ctx.switchToHttp().getRequest<RequisicaoAutenticada>()
    return campo ? usuario?.[campo] : usuario
  },
)
