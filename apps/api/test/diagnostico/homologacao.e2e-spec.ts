import * as Sentry from '@sentry/nestjs'
import request from 'supertest'
import { tokenPara } from '../fabricas/auth'
import { criarUsuario } from '../fabricas/usuario'
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

  beforeEach(() => jest.mocked(Sentry.captureException).mockClear())

  it('ATLETA (qualquer papel) com token válido → 500 INTERNAL_ERROR e Sentry chamado', async () => {
    const token = await tokenPara(await criarUsuario({ papel: 'ATLETA' }))
    const resposta = await request(contexto.http)
      .get('/api/v1/diagnostico/erro')
      .set('Authorization', `Bearer ${token}`)
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

  it('sem token → 401 e Sentry não é chamado', async () => {
    const resposta = await request(contexto.http).get('/api/v1/diagnostico/erro')
    expect(resposta.status).toBe(401)
    expect(resposta.body).toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
