import { Injectable } from '@nestjs/common'
import { ErroLimiteExcedido } from '../../common/erros/erro-negocio'
import { PrismaService } from '../../infra/prisma/prisma.service'

/** Catálogo de `TentativaAcesso.tipo` (convenções §11.3); outras issues acrescentam valores. */
export const TipoTentativa = {
  LOGIN_FALHA: 'LOGIN_FALHA',
  CADASTRO: 'CADASTRO',
  RECUPERACAO_ENVIO: 'RECUPERACAO_ENVIO',
  CODIGO_TENTATIVA: 'CODIGO_TENTATIVA',
  SENHA_CONFIRMACAO_FALHA: 'SENHA_CONFIRMACAO_FALHA',
  PRESIGN: 'PRESIGN',
  VERIFICACAO_ENVIO: 'VERIFICACAO_ENVIO',
  AVISO_ENVIO: 'AVISO_ENVIO',
} as const

export type TipoTentativa = (typeof TipoTentativa)[keyof typeof TipoTentativa]

export interface LimiteTentativas {
  /** Tentativas na janela que disparam o bloqueio. */
  maximo: number
  janelaMs: number
  /** Duração do bloqueio, contada da última tentativa; padrão: `janelaMs`. */
  bloqueioMs?: number
}

export interface SituacaoLimite {
  restantes: number
  bloqueadoAte: Date | null
}

/**
 * Regra do épico #10 §14: com as `maximo` tentativas mais recentes (`recentes`, da mais nova para
 * a mais antiga), bloqueia se `tN − t1 ≤ janela` e `agora < tN + bloqueio`.
 */
export function avaliarLimite(
  recentes: Date[],
  { maximo, janelaMs, bloqueioMs = janelaMs }: LimiteTentativas,
  agora: Date,
): SituacaoLimite {
  const ultima = recentes[0]
  const primeira = recentes[maximo - 1]
  if (ultima && primeira) {
    const bloqueadoAte = new Date(ultima.getTime() + bloqueioMs)
    if (ultima.getTime() - primeira.getTime() <= janelaMs && agora < bloqueadoAte) {
      return { restantes: 0, bloqueadoAte }
    }
  }
  const inicioJanela = agora.getTime() - janelaMs
  const naJanela = recentes.filter((data) => data.getTime() > inicioJanela).length
  return { restantes: Math.max(maximo - naJanela, 0), bloqueadoAte: null }
}

/**
 * Único mecanismo de limite de tentativas do projeto (convenções §4.6, §11.3), persistido em
 * `TentativaAcesso`. Fluxo: `verificar` antes da ação, `registrar` a tentativa (ou a falha) e
 * `limpar` quando o sucesso deve zerar a contagem (ex.: login).
 */
@Injectable()
export class RateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  /** Devolve as tentativas restantes; bloqueado → `429 RATE_LIMITED` com `Retry-After`. */
  async verificar(
    tipo: TipoTentativa,
    chave: string,
    limite: LimiteTentativas,
    agora: Date = new Date(),
  ): Promise<number> {
    const recentes = await this.prisma.semEscopo.tentativaAcesso.findMany({
      where: { tipo, chave, criadoEm: { lte: agora } },
      orderBy: { criadoEm: 'desc' },
      take: limite.maximo,
      select: { criadoEm: true },
    })
    const { restantes, bloqueadoAte } = avaliarLimite(
      recentes.map(({ criadoEm }) => criadoEm),
      limite,
      agora,
    )
    if (bloqueadoAte) {
      throw new ErroLimiteExcedido(Math.ceil((bloqueadoAte.getTime() - agora.getTime()) / 1000))
    }
    return restantes
  }

  async registrar(tipo: TipoTentativa, chave: string, agora: Date = new Date()): Promise<void> {
    await this.prisma.semEscopo.tentativaAcesso.create({ data: { tipo, chave, criadoEm: agora } })
  }

  async limpar(tipo: TipoTentativa, chave: string): Promise<void> {
    await this.prisma.semEscopo.tentativaAcesso.deleteMany({ where: { tipo, chave } })
  }
}
