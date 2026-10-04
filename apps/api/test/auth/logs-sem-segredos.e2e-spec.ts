import { TERMOS_VERSAO } from '@atletica/shared'
import type { NestExpressApplication } from '@nestjs/platform-express'
import request from 'supertest'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { criarAtletica } from '../fabricas/atletica'
import { prismaTeste } from '../setup/prisma-teste'
import { criarAppPlataforma } from '../suporte/criar-app-plataforma'

const SENHA = 'SenhaSecreta2026'

// Arquivo próprio: o nestjs-pino mantém um logger raiz único por processo, criado pelo primeiro app.
describe('Logs sem segredos no cadastro e login (#57, critério 20)', () => {
  const linhas: Record<string, unknown>[] = []
  let app: NestExpressApplication

  beforeAll(async () => {
    app = await criarAppPlataforma({ LOG_LEVEL: 'trace' }, linhas)
  })

  beforeEach(async () => {
    await criarAtletica({ id: app.get(AtleticaPadraoService).id() })
    linhas.length = 0
  })

  afterAll(async () => {
    await app.close()
  })

  it('senha, access token e refresh token não aparecem nos logs nem no banco', async () => {
    const http = app.getHttpServer()
    const cadastro = await request(http).post('/api/v1/auth/cadastro').send({
      nome: 'Ana Souza',
      email: 'ana@ex.com',
      senha: SENHA,
      aceiteTermos: true,
      versaoTermos: TERMOS_VERSAO,
    })
    const login = await request(http)
      .post('/api/v1/auth/login')
      .send({ email: 'ana@ex.com', senha: SENHA })
    await request(http)
      .post('/api/v1/auth/login')
      .send({ email: 'ana@ex.com', senha: `${SENHA}x` })
    await request(http).post('/api/v1/auth/cadastro').send({ email: 'x', senha: SENHA, extra: 1 })

    expect([cadastro.status, login.status]).toEqual([201, 200])
    const corpos = [cadastro.body, login.body] as { accessToken: string; refreshToken: string }[]
    const segredos = [
      SENHA,
      ...corpos.flatMap(({ accessToken, refreshToken }) => [
        accessToken,
        refreshToken,
        refreshToken.split('.')[1] ?? '',
      ]),
    ]

    expect(linhas.length).toBeGreaterThan(0)
    const log = JSON.stringify(linhas)
    for (const segredo of segredos) expect(log).not.toContain(segredo)

    const banco = JSON.stringify([
      await prismaTeste.usuario.findMany(),
      await prismaTeste.sessao.findMany(),
    ])
    for (const segredo of segredos) expect(banco).not.toContain(segredo)
  })
})
