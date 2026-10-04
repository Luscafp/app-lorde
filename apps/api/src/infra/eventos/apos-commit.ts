import { Injectable, Logger } from '@nestjs/common'
import { ClsService, ClsServiceManager } from 'nestjs-cls'
import type { StoreContexto } from '../contexto/contexto-atletica.service'
import { PrismaService, type TransacaoComEscopo } from '../prisma/prisma.service'
import { ErroForaDeTransacao } from './erros'

type Callback = () => unknown

interface UnidadeTransacao {
  tx: TransacaoComEscopo
  callbacks: Callback[]
}

interface StoreTransacao extends StoreContexto {
  transacao?: UnidadeTransacao
}

const logger = new Logger('AposCommit')

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
      logger.error({ err: erro }, 'Falha em callback de pós-commit')
    }
  }
}

/** Transação com fila de pós-commit (convenções §8); aninhada, reutiliza a transação externa. */
@Injectable()
export class TransacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService<StoreTransacao>,
  ) {}

  executar<T>(fn: (tx: TransacaoComEscopo) => Promise<T>): Promise<T> {
    const externa = unidadeAtual(this.cls)
    return this.cls.run({ ifNested: 'inherit' }, () =>
      externa ? this.executarAninhada(externa, fn) : this.executarRaiz(fn),
    )
  }

  /** A fila só passa para a unidade externa se a interna concluir. */
  private async executarAninhada<T>(
    externa: UnidadeTransacao,
    fn: (tx: TransacaoComEscopo) => Promise<T>,
  ): Promise<T> {
    const callbacks: Callback[] = []
    this.cls.set('transacao', { tx: externa.tx, callbacks })
    const resultado = await fn(externa.tx)
    externa.callbacks.push(...callbacks)
    return resultado
  }

  /** Os callbacks rodam em segundo plano, sem atrasar a resposta. */
  private async executarRaiz<T>(fn: (tx: TransacaoComEscopo) => Promise<T>): Promise<T> {
    const callbacks: Callback[] = []
    const resultado = await this.prisma.db.$transaction(async (tx) => {
      this.cls.set('transacao', { tx, callbacks })
      return fn(tx)
    })
    this.cls.set('transacao', undefined)
    void rodarCallbacks(callbacks)
    return resultado
  }
}
