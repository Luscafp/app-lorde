import type { Papel, RespostaSessao } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import type { SessaoCriada } from './sessao.service'
import { TokenAcessoService } from './token-acesso.service'

export interface UsuarioParaSessao {
  id: string
  nome: string
  email: string
  fotoKey: string | null
  papel: Papel
  atleticaId: string
}

/** Contrato único de cadastro, login e refresh (convenções §11.2). */
@Injectable()
export class RespostaSessaoService {
  private readonly baseFotos: string | undefined

  constructor(
    private readonly tokens: TokenAcessoService,
    config: ConfigService<Env, true>,
  ) {
    this.baseFotos = config.get('R2_PUBLIC_BASE_URL', { infer: true })?.replace(/\/+$/, '')
  }

  montar(usuario: UsuarioParaSessao, { sessaoId, refreshToken }: SessaoCriada): RespostaSessao {
    const { accessToken, accessTokenExpiraEm } = this.tokens.assinar({
      sub: usuario.id,
      atl: usuario.atleticaId,
      sid: sessaoId,
    })
    return {
      accessToken,
      refreshToken,
      accessTokenExpiraEm,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        fotoUrl: this.urlFoto(usuario.fotoKey),
        papel: usuario.papel,
        atleticaId: usuario.atleticaId,
      },
    }
  }

  private urlFoto(fotoKey: string | null): string | null {
    return fotoKey && this.baseFotos ? `${this.baseFotos}/${fotoKey}` : null
  }
}
