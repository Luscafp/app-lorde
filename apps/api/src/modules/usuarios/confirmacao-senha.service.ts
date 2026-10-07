import { Injectable } from '@nestjs/common'
import { MINUTO_MS } from '../../common/tempo'
import { PrismaService } from '../../infra/prisma/prisma.service'
import { SenhaService } from '../../infra/senha/senha.service'
import { erroNaoAutenticado } from '../auth/erros'
import { RateLimitService, TipoTentativa, type LimiteTentativas } from '../auth/rate-limit.service'
import { erroSenhaIncorreta, type CampoSenha } from './erros'

/** Troca de senha (#13) e exclusão de conta (#12) dividem o contador; chave = `usuarioId`. */
export const LIMITE_SENHA_CONFIRMACAO: LimiteTentativas = { maximo: 5, janelaMs: 15 * MINUTO_MS }

/** Confere a senha da própria conta antes de uma ação sensível; cada erro conta no limite. */
@Injectable()
export class ConfirmacaoSenhaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly senhas: SenhaService,
    private readonly limites: RateLimitService,
  ) {}

  async confirmar(usuarioId: string, senha: string, campo: CampoSenha): Promise<void> {
    const tipo = TipoTentativa.SENHA_CONFIRMACAO_FALHA
    await this.limites.verificar(tipo, usuarioId, LIMITE_SENHA_CONFIRMACAO)
    const usuario = await this.prisma.db.usuario.findUnique({
      where: { id: usuarioId },
      select: { senhaHash: true },
    })
    if (!usuario) throw erroNaoAutenticado()
    if (await this.senhas.verificar(usuario.senhaHash, senha)) return
    await this.limites.registrar(tipo, usuarioId)
    throw erroSenhaIncorreta(campo)
  }
}
