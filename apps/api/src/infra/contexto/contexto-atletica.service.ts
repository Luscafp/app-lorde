import { Injectable } from '@nestjs/common'
import { ClsService, type ClsStore } from 'nestjs-cls'

/** Valores guardados no CLS de cada requisição (ou de cada `executarComAtletica`). */
export interface StoreContexto extends ClsStore {
  atleticaId?: string
  usuarioId?: string
  /** Gravado pelo middleware de request id (#48); até lá, sempre `undefined`. */
  requestId?: string
}

export interface DadosContexto {
  atleticaId: string
  usuarioId?: string
}

/**
 * Contexto da requisição (convenções §6), lido pela extensão multi-atlética do Prisma. O CLS é
 * aberto por requisição pelo middleware do `ClsModule` (contexto.module.ts); fora de HTTP (jobs,
 * seed, login antes do token) use `executarComAtletica`.
 */
@Injectable()
export class ContextoAtletica {
  constructor(private readonly cls: ClsService<StoreContexto>) {}

  /** Chamado pelo `JwtAuthGuard` (#7). Exige um contexto CLS ativo. */
  definir({ atleticaId, usuarioId }: DadosContexto): void {
    this.cls.set('atleticaId', atleticaId)
    this.cls.set('usuarioId', usuarioId)
  }

  atleticaId(): string | undefined {
    return this.ler('atleticaId')
  }

  usuarioId(): string | undefined {
    return this.ler('usuarioId')
  }

  requestId(): string | undefined {
    return this.ler('requestId')
  }

  /**
   * Executa `fn` num contexto CLS próprio com `atleticaId`. Herda `usuarioId` e `requestId` do
   * contexto externo (se houver), que volta intacto ao terminar — inclusive em chamadas aninhadas.
   *
   * O resultado de `fn` é aguardado **dentro** do contexto: as consultas do Prisma são preguiçosas
   * (só executam no `then`), então `executarComAtletica(id, () => prisma.db.evento.findMany())`
   * funciona.
   */
  executarComAtletica<T>(atleticaId: string, fn: () => T | Promise<T>): Promise<T> {
    return this.cls.run({ ifNested: 'inherit' }, async () => {
      this.cls.set('atleticaId', atleticaId)
      return await fn()
    })
  }

  private ler(chave: 'atleticaId' | 'usuarioId' | 'requestId'): string | undefined {
    return this.cls.isActive() ? this.cls.get(chave) : undefined
  }
}
