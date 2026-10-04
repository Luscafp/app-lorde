import { Injectable, Logger } from '@nestjs/common'
import { ClsService, ClsServiceManager } from 'nestjs-cls'
import type { StoreContexto } from '../contexto/contexto-atletica.service'
import { PrismaService, type TransacaoComEscopo } from '../prisma/prisma.service'

type Callback = () => unknown

interface UnidadeTransacao {
  tx: TransacaoComEscopo
  callbacks: Callback[]
}

interface StoreTransacao extends StoreContexto {
  transacao?: UnidadeTransacao
}

const logger = new Logger('AposCommit')

/** `aposCommit` fora de `TransacaoService.executar`. Bug de programação: vira 500. */
export class ErroForaDeTransacao extends Error {
  override readonly name = 'ErroForaDeTransacao'

  constructor() {
    super('aposCommit chamado fora de TransacaoService.executar.')
  }
}

function unidadeAtual(cls: ClsService<StoreTransacao>): UnidadeTransacao | undefined {
  return cls.isActive() ? cls.get('transacao') : undefined
}

/** Agenda `callback` para depois do commit da transação corrente; descartado em rollback. */
export function aposCommit(callback: Callback): void {
  const unidade = unidadeAtual(ClsServiceManager.getClsService<StoreTransacao>())
  if (!unidade) throw new ErroForaDeTransacao()
  unidade.callbacks.push(callback)
}

async function rodarCallbacks(callbacks: Callback[]): Promise<void> {
  for (const callback of callbacks) {
    try {
      await callback()
    } catch (erro) {
      const { message, stack } = erro instanceof Error ? erro : new Error(String(erro))
      logger.error(`Falha em callback de pós-commit: ${message}`, stack)
    }
  }
}

/** Transação com fila de pós-commit (convenções §8); aninhada, reutiliza a unidade externa. */
@Injectable()
export class TransacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService<StoreTransacao>,
  ) {}

  async executar<T>(fn: (tx: TransacaoComEscopo) => Promise<T>): Promise<T> {
    const externa = unidadeAtual(this.cls)
    if (externa) return fn(externa.tx)

    return this.cls.run({ ifNested: 'inherit' }, async () => {
      const callbacks: Callback[] = []
      const resultado = await this.prisma.db.$transaction(async (tx) => {
        this.cls.set('transacao', { tx, callbacks })
        return fn(tx)
      })
      this.cls.set('transacao', undefined)
      await rodarCallbacks(callbacks)
      return resultado
    })
  }
}
