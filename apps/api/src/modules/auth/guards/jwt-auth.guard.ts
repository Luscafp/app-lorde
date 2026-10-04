import { nivelDoPapel } from '@atletica/shared'
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ContextoAtletica } from '../../../infra/contexto/contexto-atletica.service'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { ehRotaPublica } from '../decorators/publico.decorator'
import { erroContaDesativada, erroNaoAutenticado } from '../erros'
import type { PayloadAcesso, RequisicaoAutenticada, UsuarioAutenticado } from '../tipos'
import { TokenAcessoService } from '../token-acesso.service'

const BEARER = /^Bearer\s+(\S+)$/i

/** Primeiro guard global: nega por padrão (RN03) e lê sessão, conta e papel a cada requisição. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenAcessoService,
    private readonly prisma: PrismaService,
    private readonly contexto: ContextoAtletica,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ehRotaPublica(this.reflector, ctx)) return true

    const requisicao = ctx.switchToHttp().getRequest<RequisicaoAutenticada>()
    const token = BEARER.exec(requisicao.headers.authorization ?? '')?.[1]
    if (!token) throw erroNaoAutenticado()

    const payload = this.tokens.verificar(token)
    const usuario = await this.carregarUsuario(payload)

    requisicao.usuario = usuario
    this.contexto.definir({ atleticaId: usuario.atleticaId, usuarioId: usuario.id })
    return true
  }

  /** Uma consulta (sessão + usuário + vínculo da atlética `atl`), sem cache (issue #7 §14). */
  private async carregarUsuario({ sub, atl, sid }: PayloadAcesso): Promise<UsuarioAutenticado> {
    const sessao = await this.prisma.semEscopo.sessao.findUnique({
      where: { id: sid },
      select: {
        usuarioId: true,
        atleticaId: true,
        revogadaEm: true,
        expiraEm: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            ativo: true,
            excluidoEm: true,
            vinculos: { where: { atleticaId: atl }, select: { papel: true, ativo: true } },
          },
        },
      },
    })

    if (
      !sessao ||
      sessao.usuarioId !== sub ||
      sessao.atleticaId !== atl ||
      sessao.revogadaEm !== null ||
      sessao.expiraEm <= new Date()
    ) {
      throw erroNaoAutenticado()
    }

    const { usuario } = sessao
    if (!usuario.ativo || usuario.excluidoEm !== null) throw erroNaoAutenticado()

    const [vinculo] = usuario.vinculos
    if (!vinculo) throw erroNaoAutenticado()
    if (!vinculo.ativo) throw erroContaDesativada()

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      atleticaId: atl,
      sessaoId: sid,
      papel: vinculo.papel,
      nivel: nivelDoPapel(vinculo.papel),
    }
  }
}
