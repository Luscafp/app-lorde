import { Injectable } from '@nestjs/common'
import { ErroLimiteExcedido } from '../../common/erros/erro-negocio'
import { PrismaService, type ClienteBase } from '../../infra/prisma/prisma.service'

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
  /** Bloqueio fixo contado da última tentativa (login); sem ele, a janela é deslizante. */
  bloqueioMs?: number
}

export interface SituacaoLimite {
  restantes: number
  bloqueadoAte: Date | null
}

/** Épico #10 §14, sobre as `maximo` tentativas mais recentes (da mais nova para a mais antiga). */
export function avaliarLimite(
  recentes: Date[],
  { maximo, janelaMs, bloqueioMs }: LimiteTentativas,
  agora: Date,
): SituacaoLimite {
  const ultima = recentes[0]
  const primeira = recentes[maximo - 1]
  if (ultima && primeira) {
    const bloqueadoAte = new Date(
      bloqueioMs === undefined ? primeira.getTime() + janelaMs : ultima.getTime() + bloqueioMs,
    )
    if (ultima.getTime() - primeira.getTime() <= janelaMs && agora < bloqueadoAte) {
      return { restantes: 0, bloqueadoAte }
    }
  }
  const inicioJanela = agora.getTime() - janelaMs
  const naJanela = recentes.filter((data) => data.getTime() > inicioJanela).length
  return { restantes: Math.max(maximo - naJanela, 0), bloqueadoAte: null }
}

/** Único mecanismo de limite de tentativas (convenções §11.3); uso no README da API. */
@Injectable()
export class RateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  /** Devolve as tentativas restantes; bloqueado → `429 RATE_LIMITED` com `Retry-After`. */
  verificar(
    tipo: TipoTentativa,
    chave: string,
    limite: LimiteTentativas,
    agora: Date = new Date(),
  ): Promise<number> {
    return verificarCom(this.prisma.semEscopo, tipo, chave, limite, agora)
  }

  /** Instante em que a chave volta a ter tentativas; `null` se já tem. Não lança. */
  async liberadoEm(
    tipo: TipoTentativa,
    chave: string,
    limite: LimiteTentativas,
    agora: Date = new Date(),
  ): Promise<Date | null> {
    const recentes = await recentesDe(this.prisma.semEscopo, tipo, chave, limite, agora)
    return avaliarLimite(recentes, limite, agora).bloqueadoAte
  }

  async registrar(tipo: TipoTentativa, chave: string, agora: Date = new Date()): Promise<void> {
    await this.prisma.semEscopo.tentativaAcesso.create({ data: { tipo, chave, criadoEm: agora } })
  }

  /** `verificar` + `registrar` sob lock da chave: requisições simultâneas não passam do limite. */
  consumir(
    tipo: TipoTentativa,
    chave: string,
    limite: LimiteTentativas,
    agora: Date = new Date(),
  ): Promise<number> {
    return this.prisma.semEscopo.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tipo}|${chave}`}))`
      const restantes = await verificarCom(tx, tipo, chave, limite, agora)
      await tx.tentativaAcesso.create({ data: { tipo, chave, criadoEm: agora } })
      return restantes - 1
    })
  }

  async limpar(tipo: TipoTentativa, chave: string): Promise<void> {
    await this.prisma.semEscopo.tentativaAcesso.deleteMany({ where: { tipo, chave } })
  }

  /** Apaga as chaves que começam com `prefixo` (ex.: as falhas de login `email|ip` de um e-mail). */
  async limparPorPrefixo(
    tipo: TipoTentativa,
    prefixo: string,
    cliente: Pick<ClienteBase, '$executeRaw'> = this.prisma.semEscopo,
  ): Promise<void> {
    // `left()` em vez de LIKE: `_` e `%` são válidos num e-mail.
    await cliente.$executeRaw`DELETE FROM "TentativaAcesso" WHERE tipo = ${tipo} AND left(chave, ${prefixo.length}) = ${prefixo}`
  }
}

async function verificarCom(
  cliente: Pick<ClienteBase, 'tentativaAcesso'>,
  tipo: TipoTentativa,
  chave: string,
  limite: LimiteTentativas,
  agora: Date,
): Promise<number> {
  const recentes = await recentesDe(cliente, tipo, chave, limite, agora)
  const { restantes, bloqueadoAte } = avaliarLimite(recentes, limite, agora)
  if (bloqueadoAte) {
    throw new ErroLimiteExcedido(Math.ceil((bloqueadoAte.getTime() - agora.getTime()) / 1000))
  }
  return restantes
}

async function recentesDe(
  cliente: Pick<ClienteBase, 'tentativaAcesso'>,
  tipo: TipoTentativa,
  chave: string,
  limite: LimiteTentativas,
  agora: Date,
): Promise<Date[]> {
  const recentes = await cliente.tentativaAcesso.findMany({
    where: { tipo, chave, criadoEm: { lte: agora } },
    orderBy: { criadoEm: 'desc' },
    take: limite.maximo,
    select: { criadoEm: true },
  })
  return recentes.map(({ criadoEm }) => criadoEm)
}
