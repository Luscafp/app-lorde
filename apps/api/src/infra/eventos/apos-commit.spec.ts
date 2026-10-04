import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ClsModule } from 'nestjs-cls'
import { PrismaService, type TransacaoComEscopo } from '../prisma/prisma.service'
import { aposCommit, ErroForaDeTransacao, TransacaoService } from './apos-commit'

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
    expect(segundo).toHaveBeenCalled()
    expect(erro).toHaveBeenCalledWith(expect.stringContaining('quebrou'), expect.any(String))
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

  it('aposCommit dentro de um callback de pós-commit lança erro', async () => {
    const erro = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    await transacao.executar(async () => {
      aposCommit(() => aposCommit(jest.fn()))
      await Promise.resolve()
    })
    expect(erro).toHaveBeenCalledWith(
      expect.stringContaining('fora de TransacaoService.executar'),
      expect.any(String),
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
    expect(chamados.sort()).toEqual(['a', 'b'])
  })
})
