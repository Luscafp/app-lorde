import * as Sentry from '@sentry/nestjs'
import type { ContextoAtletica } from '../../../infra/contexto/contexto-atletica.service'
import { GatilhosOuvinte } from './gatilhos.ouvinte'
import type { GatilhosService } from './gatilhos.service'

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }))

const PAYLOAD = { atleticaId: 'atl', noticiaId: 'n1', autorId: 'u1' }

function preparar() {
  const noticiaPublicada = jest.fn().mockResolvedValue(undefined)
  const atleticas: string[] = []
  const contexto = {
    executarComAtletica: jest.fn((atleticaId: string, fn: () => Promise<void>) => {
      atleticas.push(atleticaId)
      return fn()
    }),
  }
  const ouvinte = new GatilhosOuvinte(
    { noticiaPublicada } as unknown as GatilhosService,
    contexto as unknown as ContextoAtletica,
  )
  return { ouvinte, noticiaPublicada, atleticas }
}

describe('GatilhosOuvinte', () => {
  it('roda o gatilho no contexto da atlética do payload', async () => {
    const { ouvinte, noticiaPublicada, atleticas } = preparar()

    await ouvinte.aoPublicarNoticia(PAYLOAD)

    expect(noticiaPublicada).toHaveBeenCalledWith(PAYLOAD)
    expect(atleticas).toEqual(['atl'])
  })

  it('falha vai ao Sentry e não propaga', async () => {
    const { ouvinte, noticiaPublicada } = preparar()
    noticiaPublicada.mockRejectedValue(new Error('banco fora'))

    await expect(ouvinte.aoPublicarNoticia(PAYLOAD)).resolves.toBeUndefined()
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { modulo: 'notificacoes', evento: 'noticia.publicada' },
      extra: { atleticaId: 'atl' },
    })
  })
})
