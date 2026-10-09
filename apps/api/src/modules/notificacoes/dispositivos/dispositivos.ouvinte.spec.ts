import * as Sentry from '@sentry/nestjs'
import { DispositivosOuvinte } from './dispositivos.ouvinte'
import type { DispositivosService } from './dispositivos.service'

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }))

function preparar() {
  const removerDasSessoes = jest.fn().mockResolvedValue(1)
  const ouvinte = new DispositivosOuvinte({ removerDasSessoes } as unknown as DispositivosService)
  return { ouvinte, removerDasSessoes }
}

describe('DispositivosOuvinte', () => {
  it('logout remove só os aparelhos das sessões encerradas', async () => {
    const { ouvinte, removerDasSessoes } = preparar()

    await ouvinte.aoEncerrarSessao({
      usuarioId: 'u1',
      sessaoIds: ['s1', 's2'],
      motivo: 'TROCA_SENHA',
      autorId: 'u1',
    })

    expect(removerDasSessoes).toHaveBeenCalledWith('u1', ['s1', 's2'], false)
  })

  it('exclusão de conta remove todos os aparelhos do usuário', async () => {
    const { ouvinte, removerDasSessoes } = preparar()

    await ouvinte.aoEncerrarSessao({
      usuarioId: 'u1',
      sessaoIds: ['s1'],
      motivo: 'CONTA_EXCLUIDA',
      autorId: 'u1',
    })

    expect(removerDasSessoes).toHaveBeenCalledWith('u1', ['s1'], true)
  })

  it('falha vai ao Sentry e não propaga', async () => {
    const { ouvinte, removerDasSessoes } = preparar()
    removerDasSessoes.mockRejectedValue(new Error('banco fora'))

    await expect(
      ouvinte.aoEncerrarSessao({
        usuarioId: 'u1',
        sessaoIds: ['s1'],
        motivo: 'LOGOUT',
        autorId: 'u1',
      }),
    ).resolves.toBeUndefined()
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
