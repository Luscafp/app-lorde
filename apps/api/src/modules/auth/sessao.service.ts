import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'

export const VALIDADE_SESSAO_MS = 30 * 24 * 60 * 60 * 1000
const BYTES_SEGREDO = 32
const TAMANHO_USER_AGENT = 255
const TAMANHO_IP = 45

export interface DadosNovaSessao {
  usuarioId: string
  atleticaId: string
  userAgent?: string
  ip?: string
}

export interface SessaoCriada {
  sessaoId: string
  /** `<sessaoId>.<segredo>`, entregue só ao cliente. */
  refreshToken: string
}

/** No banco fica só o SHA-256 (hex) do segredo do refresh token (épico #10 §10). */
export function hashSegredo(segredo: string): string {
  return createHash('sha256').update(segredo).digest('hex')
}

/** Uma `Sessao` = um login em um dispositivo. Rotação, revogação e logout: #58. */
@Injectable()
export class SessaoService {
  async criar(
    tx: TransacaoComEscopo,
    { usuarioId, atleticaId, userAgent, ip }: DadosNovaSessao,
    agora: Date = new Date(),
  ): Promise<SessaoCriada> {
    const sessaoId = randomUUID()
    const segredo = randomBytes(BYTES_SEGREDO).toString('base64url')
    await tx.sessao.create({
      data: {
        id: sessaoId,
        usuarioId,
        atleticaId,
        refreshTokenHash: hashSegredo(segredo),
        expiraEm: new Date(agora.getTime() + VALIDADE_SESSAO_MS),
        userAgent: userAgent?.slice(0, TAMANHO_USER_AGENT),
        ip: ip?.slice(0, TAMANHO_IP),
      },
    })
    return { sessaoId, refreshToken: `${sessaoId}.${segredo}` }
  }
}
