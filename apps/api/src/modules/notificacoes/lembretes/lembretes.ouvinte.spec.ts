import * as Sentry from '@sentry/nestjs'
import { LembretesOuvinte } from './lembretes.ouvinte'
import type { LembretesService } from './lembretes.service'

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }))

function preparar() {
  const reconciliarEventos = jest.fn().mockResolvedValue(2)
  const ouvinte = new LembretesOuvinte({ reconciliarEventos } as unknown as LembretesService)
  return { ouvinte, reconciliarEventos }
}

const BASE = { atleticaId: 'atl-1', timeId: 't1', autorId: 'u1' }

describe('LembretesOuvinte', () => {
  it('evento criado reconcilia só o evento', async () => {
    const { ouvinte, reconciliarEventos } = preparar()

    await ouvinte.aoCriarEvento({ ...BASE, eventoId: 'e1' })

    expect(reconciliarEventos).toHaveBeenCalledWith('atl-1', { id: 'e1' })
  })

  it('série criada reconcilia todas as ocorrências', async () => {
    const { ouvinte, reconciliarEventos } = preparar()

    await ouvinte.aoCriarEvento({ ...BASE, eventoId: 'e1', serieId: 's1' })

    expect(reconciliarEventos).toHaveBeenCalledWith('atl-1', { serieId: 's1' })
  })

  it('evento alterado reconcilia os ids alterados', async () => {
    const { ouvinte, reconciliarEventos } = preparar()

    await ouvinte.aoAlterarEvento({ ...BASE, eventoIds: ['e1', 'e2'], campos: ['inicio'] })

    expect(reconciliarEventos).toHaveBeenCalledWith('atl-1', { id: { in: ['e1', 'e2'] } })
  })

  it('mudança só de status não reconcilia', async () => {
    const { ouvinte, reconciliarEventos } = preparar()

    await ouvinte.aoAlterarEvento({ ...BASE, eventoIds: ['e1'], campos: ['status'] })

    expect(reconciliarEventos).not.toHaveBeenCalled()
  })

  it('alteração sem campos informados reconcilia', async () => {
    const { ouvinte, reconciliarEventos } = preparar()

    await ouvinte.aoAlterarEvento({ ...BASE, eventoIds: ['e1'], campos: [] })

    expect(reconciliarEventos).toHaveBeenCalledWith('atl-1', { id: { in: ['e1'] } })
  })

  it('falha vai ao Sentry e não propaga', async () => {
    const { ouvinte, reconciliarEventos } = preparar()
    reconciliarEventos.mockRejectedValue(new Error('banco fora'))

    await expect(ouvinte.aoCriarEvento({ ...BASE, eventoId: 'e1' })).resolves.toBeUndefined()
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
