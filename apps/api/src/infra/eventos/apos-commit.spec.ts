import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ClsModule } from 'nestjs-cls'
import { PrismaService, type TransacaoComEscopo } from '../prisma/prisma.service'
import { aposCommit, TransacaoService } from './apos-commit'
import { ErroForaDeTransacao } from './erros'

const callbacksConcluidos = () => new Promise((resolver) => setImmediate(resolver))

describe('TransacaoService e aposCommit', () => {
  let transacao: TransacaoService
  const $transaction = jest.fn()

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true })],
      providers: [TransacaoService, { provide: PrismaService, useValue: { db: { $transaction } } }],
    }).compile()
    transacao = modulo.get(TransacaoService)
  })

  beforeEach(() => {
    $transaction.mockReset()
    $transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({ id: 'tx' }))
  })

  it('fora de uma unidade de transação lança erro (critério 16)', () => {
    expect(() => aposCommit(jest.fn())).toThrow(ErroForaDeTransacao)
  })

  it('roda os callbacks depois do commit, na ordem de registro', async () => {
    const ordem: string[] = []
    $transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const resultado = await fn({ id: 'tx' })
      ordem.push('commit')
      return resultado
    })
    const resultado = await transacao.executar(() => {
      aposCommit(() => ordem.push('a'))
      aposCommit(() => ordem.push('b'))
      ordem.push('fn')
      return Promise.resolve(42)
    })
    await callbacksConcluidos()
    expect(resultado).toBe(42)
    expect(ordem).toEqual(['fn', 'commit', 'a', 'b'])
  })

  it('rollback descarta os callbacks (critério 14)', async () => {
    const callback = jest.fn()
    await expect(
      transacao.executar(() => {
        aposCommit(callback)
        return Promise.reject(new Error('falhou'))
      }),
    ).rejects.toThrow('falhou')
    expect(callback).not.toHaveBeenCalled()
  })

  it('erro num callback é logado e não impede os seguintes', async () => {
    const erro = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const segundo = jest.fn()
    await transacao.executar(async () => {
      aposCommit(() => {
        throw new Error('quebrou')
      })
      aposCommit(segundo)
      await Promise.resolve()
    })
    await callbacksConcluidos()
    expect(segundo).toHaveBeenCalled()
    expect(erro).toHaveBeenCalledWith(
      expect.objectContaining({ err: new Error('quebrou') }),
      'Falha em callback de pós-commit',
    )
    erro.mockRestore()
  })

  it('aninhada usa a transação e a unidade externas (critério 17)', async () => {
    const interno = jest.fn()
    let txInterna: TransacaoComEscopo | undefined
    await expect(
      transacao.executar(async (txExterna) => {
        await transacao.executar(async (tx) => {
          txInterna = tx
          aposCommit(interno)
          await Promise.resolve()
        })
        expect(txInterna).toBe(txExterna)
        throw new Error('externa falhou')
      }),
    ).rejects.toThrow('externa falhou')
    expect($transaction).toHaveBeenCalledTimes(1)
    expect(interno).not.toHaveBeenCalled()
  })

  it('aninhada que falha descarta só os próprios callbacks, mesmo com a externa confirmada', async () => {
    const externo = jest.fn()
    const interno = jest.fn()
    await transacao.executar(async () => {
      aposCommit(externo)
      await transacao
        .executar(() => {
          aposCommit(interno)
          return Promise.reject(new Error('interna falhou'))
        })
        .catch(() => undefined)
    })
    await callbacksConcluidos()
    expect(externo).toHaveBeenCalled()
    expect(interno).not.toHaveBeenCalled()
  })

  it('aninhada concluída roda os callbacks só no commit externo', async () => {
    const ordem: string[] = []
    $transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const resultado = await fn({ id: 'tx' })
      ordem.push('commit')
      return resultado
    })
    await transacao.executar(async () => {
      aposCommit(() => ordem.push('externo'))
      await transacao.executar(() => {
        aposCommit(() => ordem.push('interno'))
        return Promise.resolve()
      })
    })
    await callbacksConcluidos()
    expect(ordem).toEqual(['commit', 'externo', 'interno'])
  })

  it('callback lento não atrasa o retorno de executar', async () => {
    let liberar = () => {}
    const lento = new Promise<void>((resolver) => (liberar = resolver))
    const depois = jest.fn()
    await transacao.executar(async () => {
      aposCommit(() => lento)
      aposCommit(depois)
      await Promise.resolve()
    })
    expect(depois).not.toHaveBeenCalled()
    liberar()
    await callbacksConcluidos()
    expect(depois).toHaveBeenCalled()
  })

  it('aposCommit dentro de um callback de pós-commit lança erro', async () => {
    const erro = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    await transacao.executar(async () => {
      aposCommit(() => aposCommit(jest.fn()))
      await Promise.resolve()
    })
    await callbacksConcluidos()
    expect(erro).toHaveBeenCalledWith(
      expect.objectContaining({ err: new ErroForaDeTransacao() }),
      'Falha em callback de pós-commit',
    )
    erro.mockRestore()
  })

  it('transações concorrentes não misturam as filas', async () => {
    const chamados: string[] = []
    const executar = (nome: string, atraso: number) =>
      transacao.executar(async () => {
        await new Promise((resolver) => setTimeout(resolver, atraso))
        aposCommit(() => chamados.push(nome))
      })
    await Promise.all([executar('a', 20), executar('b', 5)])
    await callbacksConcluidos()
    expect(chamados.sort()).toEqual(['a', 'b'])
  })
})
