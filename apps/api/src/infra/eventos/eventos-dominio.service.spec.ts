import type { EventEmitter2 } from '@nestjs/event-emitter'
import { ClsModule } from 'nestjs-cls'
import { Test } from '@nestjs/testing'
import { PrismaService } from '../prisma/prisma.service'
import { TransacaoService } from './apos-commit'
import { ErroForaDeTransacao } from './erros'
import type { PayloadBase } from './eventos-dominio'
import { EventosDominioService } from './eventos-dominio.service'

declare module './eventos-dominio' {
  interface EventosDominio {
    'teste.unitario': PayloadBase & { valor: number }
  }
}

describe('EventosDominioService', () => {
  const emit = jest.fn()
  let eventos: EventosDominioService
  let transacao: TransacaoService

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true })],
      providers: [
        TransacaoService,
        {
          provide: PrismaService,
          useValue: { db: { $transaction: (fn: (tx: unknown) => unknown) => fn({}) } },
        },
      ],
    }).compile()
    transacao = modulo.get(TransacaoService)
    eventos = new EventosDominioService({ emit } as unknown as EventEmitter2)
  })

  beforeEach(() => emit.mockReset())

  it('emite só depois do commit', async () => {
    await transacao.executar(async () => {
      eventos.emitirAposCommit('teste.unitario', { valor: 1, autorId: null })
      expect(emit).not.toHaveBeenCalled()
      await Promise.resolve()
    })
    expect(emit).toHaveBeenCalledWith('teste.unitario', { valor: 1, autorId: null })
  })

  it('fora de transação lança erro', () => {
    expect(() => eventos.emitirAposCommit('teste.unitario', { valor: 1, autorId: 'u' })).toThrow(
      ErroForaDeTransacao,
    )
  })
})

// Critério 18: nome fora do mapa ou payload sem `autorId` não compilam (`pnpm typecheck`).
export function mapaTipado(eventos: EventosDominioService): void {
  // @ts-expect-error nome fora de EventosDominio
  eventos.emitirAposCommit('teste.inexistente', { autorId: null })
  // @ts-expect-error payload sem autorId
  eventos.emitirAposCommit('teste.unitario', { valor: 1 })
  // @ts-expect-error payload com tipo errado
  eventos.emitirAposCommit('teste.unitario', { valor: 'um', autorId: null })
}
