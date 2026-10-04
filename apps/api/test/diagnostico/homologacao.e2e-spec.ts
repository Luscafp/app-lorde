import * as Sentry from '@sentry/nestjs'
import request from 'supertest'
import { criarAppEm, type AppEmAmbiente } from '../suporte/app-em-ambiente'

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }))

describe('GET /api/v1/diagnostico/erro com APP_ENV=homologacao (#48)', () => {
  let contexto: AppEmAmbiente

  beforeAll(async () => {
    contexto = await criarAppEm('homologacao')
  })

  afterAll(async () => {
    await contexto.encerrar()
  })

  it('500 INTERNAL_ERROR e Sentry chamado', async () => {
    const resposta = await request(contexto.http).get('/api/v1/diagnostico/erro')
    expect(resposta.status).toBe(500)
    expect(resposta.body).toMatchObject({ code: 'INTERNAL_ERROR' })
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ route: '/api/v1/diagnostico/erro' }) as object,
      }),
    )
  })
})
