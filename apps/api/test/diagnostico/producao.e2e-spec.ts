import request from 'supertest'
import { criarAppEm, type AppEmAmbiente } from '../suporte/app-em-ambiente'

describe('GET /api/v1/diagnostico/erro com APP_ENV=producao (#48)', () => {
  let contexto: AppEmAmbiente

  beforeAll(async () => {
    contexto = await criarAppEm('producao')
  })

  afterAll(async () => {
    await contexto.encerrar()
  })

  it('controller não registrado → 404', async () => {
    const resposta = await request(contexto.http).get('/api/v1/diagnostico/erro')
    expect(resposta.status).toBe(404)
    expect(resposta.body).toMatchObject({ code: 'NOT_FOUND' })
  })
})
