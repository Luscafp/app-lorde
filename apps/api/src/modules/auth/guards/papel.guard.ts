import { type Papel, temNivelMinimo } from '@atletica/shared'
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PAPEL_MINIMO } from '../decorators/papel-minimo.decorator'
import { ehRotaPublica } from '../decorators/publico.decorator'
import { erroNaoAutenticado, erroSemPermissao } from '../erros'
import type { RequisicaoAutenticada } from '../tipos'

/** Segundo guard global: confere `@PapelMinimo` com o papel já lido pelo `JwtAuthGuard`. */
@Injectable()
export class PapelGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (ehRotaPublica(this.reflector, ctx)) return true

    const minimo = this.reflector.getAllAndOverride<Papel | undefined>(PAPEL_MINIMO, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!minimo) return true

    const { usuario } = ctx.switchToHttp().getRequest<RequisicaoAutenticada>()
    if (!usuario) throw erroNaoAutenticado()
    if (!temNivelMinimo(usuario.papel, minimo)) throw erroSemPermissao()
    return true
  }
}
