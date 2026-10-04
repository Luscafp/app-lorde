import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { erroNaoAutenticado, erroTokenExpirado } from './erros'
import type { PayloadAcesso } from './tipos'
import { OPCOES_VERIFICACAO, payloadAcessoSchema, TOLERANCIA_RELOGIO } from './token.config'

@Injectable()
export class TokenAcessoService {
  constructor(private readonly jwt: JwtService) {}

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
    if (resultado.data.exp + TOLERANCIA_RELOGIO <= segundos) throw erroTokenExpirado()
    return resultado.data
  }
}
