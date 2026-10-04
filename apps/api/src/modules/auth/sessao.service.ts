import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import type { MotivoRevogacao } from '../../infra/eventos/eventos-dominio'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'

export const VALIDADE_SESSAO_MS = 30 * 24 * 60 * 60 * 1000
/** Reapresentar o token anterior dentro dela é corrida do próprio app, não reuso (épico #10 §7.3). */
export const JANELA_CONCORRENCIA_MS = 30_000
const BYTES_SEGREDO = 32
const TAMANHO_USER_AGENT = 255
const TAMANHO_IP = 45
const FORMATO_REFRESH_TOKEN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i

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

export interface SessaoDoUsuario {
  sessaoId: string
  usuarioId: string
}

export type ResultadoRotacao =
  | (SessaoCriada & { tipo: 'ROTACIONADA'; usuarioId: string; atleticaId: string })
  | { tipo: 'INVALIDO' }
  | { tipo: 'REVOGADA' }
  | { tipo: 'JA_ROTACIONADO' }
  /** A sessão foi revogada nesta chamada com `REUSO_REFRESH`; reuso concorrente já revogado é `REVOGADA`. */
  | (SessaoDoUsuario & { tipo: 'REUSO' })

export interface OpcoesRevogarTodas {
  /** Sessão preservada (ex.: o aparelho atual na troca de senha). */
  exceto?: string
  atleticaId?: string
}

/** No banco fica só o SHA-256 (hex) do segredo do refresh token (épico #10 §10). */
export function hashSegredo(segredo: string): string {
  return createHash('sha256').update(segredo).digest('hex')
}

function gerarSegredo(): string {
  return randomBytes(BYTES_SEGREDO).toString('base64url')
}

function lerRefreshToken(refreshToken: string): { sessaoId: string; hash: string } | null {
  const [, sessaoId, segredo] = FORMATO_REFRESH_TOKEN.exec(refreshToken) ?? []
  return sessaoId && segredo
    ? { sessaoId: sessaoId.toLowerCase(), hash: hashSegredo(segredo) }
    : null
}

function montarRefreshToken(sessaoId: string, segredo: string): string {
  return `${sessaoId}.${segredo}`
}

function novaExpiracao(agora: Date): Date {
  return new Date(agora.getTime() + VALIDADE_SESSAO_MS)
}

function dadosRevogacao(motivo: MotivoRevogacao, agora: Date) {
  return { revogadaEm: agora, motivoRevogacao: motivo }
}

function hashesIguais(a: string, b: string | null): boolean {
  return b !== null && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

/** Uma `Sessao` = um login em um dispositivo (a "família" de refresh tokens). */
@Injectable()
export class SessaoService {
  async criar(
    tx: TransacaoComEscopo,
    { usuarioId, atleticaId, userAgent, ip }: DadosNovaSessao,
    agora: Date = new Date(),
  ): Promise<SessaoCriada> {
    const sessaoId = randomUUID()
    const segredo = gerarSegredo()
    await tx.sessao.create({
      data: {
        id: sessaoId,
        usuarioId,
        atleticaId,
        refreshTokenHash: hashSegredo(segredo),
        expiraEm: novaExpiracao(agora),
        userAgent: userAgent?.slice(0, TAMANHO_USER_AGENT),
        ip: ip?.slice(0, TAMANHO_IP),
      },
    })
    return { sessaoId, refreshToken: montarRefreshToken(sessaoId, segredo) }
  }

  /** `UPDATE` condicional atômico; sem linha afetada, a releitura classifica a falha (épico #10 §7.3). */
  async rotacionar(
    tx: TransacaoComEscopo,
    refreshToken: string,
    agora: Date = new Date(),
  ): Promise<ResultadoRotacao> {
    const credencial = lerRefreshToken(refreshToken)
    if (!credencial) return { tipo: 'INVALIDO' }
    const { sessaoId, hash } = credencial

    const segredo = gerarSegredo()
    const [rotacionada] = await tx.sessao.updateManyAndReturn({
      where: { id: sessaoId, refreshTokenHash: hash, revogadaEm: null, expiraEm: { gt: agora } },
      data: {
        refreshTokenHash: hashSegredo(segredo),
        refreshTokenAnteriorHash: hash,
        rotacionadaEm: agora,
        expiraEm: novaExpiracao(agora),
      },
      select: { usuarioId: true, atleticaId: true },
    })
    if (rotacionada) {
      return {
        tipo: 'ROTACIONADA',
        sessaoId,
        refreshToken: montarRefreshToken(sessaoId, segredo),
        ...rotacionada,
      }
    }

    const sessao = await tx.sessao.findUnique({
      where: { id: sessaoId },
      select: {
        usuarioId: true,
        refreshTokenAnteriorHash: true,
        rotacionadaEm: true,
        expiraEm: true,
        revogadaEm: true,
      },
    })
    if (!sessao || sessao.expiraEm <= agora) return { tipo: 'INVALIDO' }
    if (sessao.revogadaEm) return { tipo: 'REVOGADA' }
    const rotacaoRecente =
      sessao.rotacionadaEm !== null &&
      agora.getTime() - sessao.rotacionadaEm.getTime() < JANELA_CONCORRENCIA_MS
    if (rotacaoRecente && hashesIguais(hash, sessao.refreshTokenAnteriorHash)) {
      return { tipo: 'JA_ROTACIONADO' }
    }

    const revogadaAgora = await this.revogar(tx, sessaoId, 'REUSO_REFRESH', agora)
    if (!revogadaAgora) return { tipo: 'REVOGADA' }
    return { tipo: 'REUSO', sessaoId, usuarioId: sessao.usuarioId }
  }

  /** `true` se a sessão estava ativa e foi revogada agora. */
  async revogar(
    tx: TransacaoComEscopo,
    sessaoId: string,
    motivo: MotivoRevogacao,
    agora: Date = new Date(),
  ): Promise<boolean> {
    const { count } = await tx.sessao.updateMany({
      where: { id: sessaoId, revogadaEm: null },
      data: dadosRevogacao(motivo, agora),
    })
    return count === 1
  }

  /** Logout: aceita o token atual ou o anterior; `null` = nada revogado (formato, inexistente, já revogada). */
  async revogarPorToken(
    tx: TransacaoComEscopo,
    refreshToken: string,
    motivo: MotivoRevogacao,
    agora: Date = new Date(),
  ): Promise<SessaoDoUsuario | null> {
    const credencial = lerRefreshToken(refreshToken)
    if (!credencial) return null
    const { sessaoId, hash } = credencial

    const [sessao] = await tx.sessao.updateManyAndReturn({
      where: {
        id: sessaoId,
        revogadaEm: null,
        OR: [{ refreshTokenHash: hash }, { refreshTokenAnteriorHash: hash }],
      },
      data: dadosRevogacao(motivo, agora),
      select: { usuarioId: true },
    })
    return sessao ? { sessaoId, usuarioId: sessao.usuarioId } : null
  }

  /** Usada por #62, #12, #13, #27; devolve só os ids revogados agora (`sessaoIds` do evento). */
  async revogarTodas(
    tx: TransacaoComEscopo,
    usuarioId: string,
    motivo: MotivoRevogacao,
    { exceto, atleticaId }: OpcoesRevogarTodas = {},
    agora: Date = new Date(),
  ): Promise<string[]> {
    const revogadas = await tx.sessao.updateManyAndReturn({
      where: {
        usuarioId,
        revogadaEm: null,
        expiraEm: { gt: agora },
        ...(exceto && { id: { not: exceto } }),
        ...(atleticaId && { atleticaId }),
      },
      data: dadosRevogacao(motivo, agora),
      select: { id: true },
    })
    return revogadas.map(({ id }) => id)
  }
}
