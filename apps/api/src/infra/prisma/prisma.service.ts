import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import type { ITXClientDenyList } from '@prisma/client/runtime/client'
import type { Env } from '../../config/env.schema'
import { PrismaClient } from '../../generated/prisma/client'
import { ContextoAtletica } from '../contexto/contexto-atletica.service'
import { extensaoAtletica } from './extensao-atletica'

function criarClienteComEscopo(base: PrismaClient, contexto: ContextoAtletica) {
  return base.$extends(extensaoAtletica(contexto))
}

/** Cliente com o filtro por atlética (`prisma.db`). */
export type ClienteComEscopo = ReturnType<typeof criarClienteComEscopo>

/** Cliente recebido em `prisma.db.$transaction(async (tx) => ...)`, também com o filtro. */
export type TransacaoComEscopo = Omit<ClienteComEscopo, ITXClientDenyList>

/**
 * Acesso ao banco (épico #3 §3 item 3). Use `db` em todos os services; `semEscopo` só nos caminhos
 * permitidos pela regra de lint (convenções §3) — ver README, "Banco de dados".
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  /** Cliente base, **sem** filtro por atlética. Uso restrito (lint). */
  readonly semEscopo: PrismaClient
  /** Cliente com o filtro por atlética do contexto (RNF20). Padrão. */
  readonly db: ClienteComEscopo

  constructor(config: ConfigService<Env, true>, contexto: ContextoAtletica) {
    this.semEscopo = new PrismaClient({
      adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) }),
    })
    this.db = criarClienteComEscopo(this.semEscopo, contexto)
  }

  async onModuleInit(): Promise<void> {
    await this.semEscopo.$connect()
  }

  /** Chamado no `app.close()` e nos sinais de término (`enableShutdownHooks`). */
  async onModuleDestroy(): Promise<void> {
    await this.semEscopo.$disconnect()
  }
}
