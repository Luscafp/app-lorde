import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { erroNaoAutenticado, erroTokenExpirado } from './erros'
import type { PayloadAcesso } from './tipos'
import {
  OPCOES_ASSINATURA,
  OPCOES_VERIFICACAO,
  payloadAcessoSchema,
  TOLERANCIA_RELOGIO,
  VALIDADE_TOKEN_ACESSO,
} from './token.config'

export interface TokenAcessoEmitido {
  accessToken: string
  accessTokenExpiraEm: string
}

@Injectable()
export class TokenAcessoService {
  constructor(private readonly jwt: JwtService) {}

  /** Assina o access token (convenções §5); o papel não vai no token. */
  assinar(
    { sub, atl, sid }: Pick<PayloadAcesso, 'sub' | 'atl' | 'sid'>,
    agora: Date = new Date(),
  ): TokenAcessoEmitido {
    const iat = Math.floor(agora.getTime() / 1000)
    return {
      accessToken: this.jwt.sign({ sub, atl, sid, iat }, OPCOES_ASSINATURA),
      accessTokenExpiraEm: new Date((iat + VALIDADE_TOKEN_ACESSO) * 1000).toISOString(),
    }
  }

  /** Lança `401 UNAUTHENTICATED` (inválido) ou `401 TOKEN_EXPIRED` (vencido além da tolerância). */
  verificar(token: string, agora: Date = new Date()): PayloadAcesso {
    let bruto: unknown
    try {
      bruto = this.jwt.verify<object>(token, OPCOES_VERIFICACAO)
    } catch {
      throw erroNaoAutenticado()
    }

    const resultado = payloadAcessoSchema.safeParse(bruto)
    if (!resultado.success) throw erroNaoAutenticado()

    const segundos = Math.floor(agora.getTime() / 1000)
    if (resultado.data.exp + TOLERANCIA_RELOGIO < segundos) throw erroTokenExpirado()
    return resultado.data
  }
}
