import { createHash } from 'node:crypto'
import { respostaSessaoSchema, TERMOS_VERSAO, type RespostaSessao } from '@atletica/shared'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { criarUsuario } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'
import { AuthTesteController } from '../suporte/auth.controller'

const ROTA = '/api/v1/auth/cadastro'
const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000

const VALIDO = {
  nome: 'Ana Souza',
  email: '  Ana@Ex.com ',
  senha: 'lorde2026',
  aceiteTermos: true,
  versaoTermos: TERMOS_VERSAO,
}

describe('POST /auth/cadastro (#57)', () => {
  let contexto: AppDeTeste
  let padraoId: string
  let eventos: EspiaoEventos

  const cadastrar = (corpo: object = VALIDO, ip?: string) => {
    const req = request(contexto.http).post(ROTA).set('User-Agent', 'jest/1.0')
    return (ip ? req.set('X-Forwarded-For', ip) : req).send(corpo)
  }

  async function contarLinhas() {
    const [usuarios, vinculos, preferencias, aceites, sessoes] = await Promise.all([
      prismaTeste.usuario.count(),
      prismaTeste.vinculoAtletica.count(),
      prismaTeste.preferenciaNotificacao.count(),
      prismaTeste.aceiteTermos.count(),
      prismaTeste.sessao.count(),
    ])
    return { usuarios, vinculos, preferencias, aceites, sessoes }
  }

  beforeAll(async () => {
    contexto = await criarApp({ controllers: [AuthTesteController] })
    padraoId = contexto.app.get(AtleticaPadraoService).id()
  })

  beforeEach(async () => {
    await criarAtletica({ id: padraoId })
    eventos = espiarEventos(contexto.app)
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  describe('caminho feliz (critério 1)', () => {
    let corpo: RespostaSessao

    beforeEach(async () => {
      const resposta = await cadastrar(VALIDO, '10.0.0.7')
      expect(resposta.status).toBe(201)
      corpo = respostaSessaoSchema.parse(resposta.body)
    })

    it('responde o contrato da sessão com o usuário normalizado', async () => {
      const usuario = await prismaTeste.usuario.findUniqueOrThrow({
        where: { email: 'ana@ex.com' },
      })
      expect(corpo.usuario).toStrictEqual({
        id: usuario.id,
        nome: 'Ana Souza',
        email: 'ana@ex.com',
        fotoUrl: null,
        papel: 'ATLETA',
        atleticaId: padraoId,
      })
      expect(usuario.senhaHash).toMatch(/^\$argon2id\$/)
    })

    it('cria vínculo ATLETA ativo, preferências padrão, aceite e sessão', async () => {
      const usuarioId = corpo.usuario.id
      await expect(contarLinhas()).resolves.toEqual({
        usuarios: 1,
        vinculos: 1,
        preferencias: 1,
        aceites: 1,
        sessoes: 1,
      })
      await expect(prismaTeste.vinculoAtletica.findFirst()).resolves.toMatchObject({
        usuarioId,
        atleticaId: padraoId,
        papel: 'ATLETA',
        ativo: true,
      })
      await expect(prismaTeste.preferenciaNotificacao.findFirst()).resolves.toMatchObject({
        usuarioId,
        pushAtivo: true,
        avisos: true,
        antecedenciaLembreteHoras: 2,
      })
      await expect(prismaTeste.aceiteTermos.findFirst()).resolves.toMatchObject({
        usuarioId,
        versao: TERMOS_VERSAO,
        ip: '10.0.0.7',
      })
    })

    it('refresh token opaco <sessaoId>.<segredo>, com só o SHA-256 no banco', async () => {
      const [sessaoId, segredo] = corpo.refreshToken.split('.')
      expect(segredo).toMatch(/^[A-Za-z0-9_-]{43}$/)
      const sessao = await prismaTeste.sessao.findUniqueOrThrow({ where: { id: sessaoId } })
      expect(sessao).toMatchObject({
        usuarioId: corpo.usuario.id,
        atleticaId: padraoId,
        refreshTokenHash: createHash('sha256')
          .update(segredo ?? '')
          .digest('hex'),
        refreshTokenAnteriorHash: null,
        revogadaEm: null,
        userAgent: 'jest/1.0',
        ip: '10.0.0.7',
      })
      expect(sessao.expiraEm.getTime() - Date.now()).toBeGreaterThan(TRINTA_DIAS_MS - 60_000)
      expect(sessao.expiraEm.getTime() - Date.now()).toBeLessThanOrEqual(TRINTA_DIAS_MS)
    })

    it('JWT com sub, atl, sid, iss e aud, 15 min, sem o papel', () => {
      const payload = new JwtService().decode<Record<string, unknown>>(corpo.accessToken)
      expect(payload).toStrictEqual({
        sub: corpo.usuario.id,
        atl: padraoId,
        sid: corpo.refreshToken.split('.')[0],
        iat: expect.any(Number) as number,
        exp: expect.any(Number) as number,
        iss: 'atletica-api',
        aud: 'atletica-app',
      })
      expect(Number(payload.exp) - Number(payload.iat)).toBe(900)
      expect(new Date(corpo.accessTokenExpiraEm).getTime()).toBe(Number(payload.exp) * 1000)
    })

    it('o access token é aceito pelo guard da #7', async () => {
      const resposta = await request(contexto.http)
        .get('/api/v1/teste-auth/eu')
        .set('Authorization', `Bearer ${corpo.accessToken}`)
      expect(resposta.status).toBe(200)
      expect(resposta.body).toMatchObject({ papel: 'ATLETA', atleticaId: padraoId })
    })

    it('emite usuario.cadastrado uma vez, após o commit, com autorId = usuarioId', async () => {
      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([
        {
          nome: 'usuario.cadastrado',
          payload: { usuarioId: corpo.usuario.id, atleticaId: padraoId, autorId: corpo.usuario.id },
        },
      ])
    })

    it('a resposta não contém a senha', () => {
      expect(JSON.stringify(corpo)).not.toContain(VALIDO.senha)
    })
  })

  describe('e-mail já cadastrado (critério 2)', () => {
    it('mesmo e-mail com outra caixa → 409 EMAIL_JA_CADASTRADO, nada criado nem emitido', async () => {
      await criarUsuario({ email: 'ana@ex.com', atleticaId: padraoId })

      const resposta = await cadastrar({ ...VALIDO, email: 'ANA@ex.com' })

      expect(resposta.status).toBe(409)
      expect(resposta.body).toMatchObject({ code: 'EMAIL_JA_CADASTRADO' })
      await expect(contarLinhas()).resolves.toMatchObject({ usuarios: 1, aceites: 0, sessoes: 0 })
      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([])
    })

    it('duas requisições simultâneas → uma 201 e outra 409', async () => {
      const respostas = await Promise.all([cadastrar(), cadastrar()])

      expect(respostas.map(({ status }) => status).sort()).toEqual([201, 409])
      expect(respostas.find(({ status }) => status === 409)?.body).toMatchObject({
        code: 'EMAIL_JA_CADASTRADO',
      })
      await expect(contarLinhas()).resolves.toEqual({
        usuarios: 1,
        vinculos: 1,
        preferencias: 1,
        aceites: 1,
        sessoes: 1,
      })
      await aguardarOuvintes()
      expect(eventos.nomes()).toEqual(['usuario.cadastrado'])
    })
  })

  describe('validação', () => {
    it('senha sem número → 400 com details[].field = "senha" (critério 3)', async () => {
      const resposta = await cadastrar({ ...VALIDO, senha: 'abcdefgh' })
      expect(resposta.status).toBe(400)
      expect(resposta.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ field: 'senha', message: 'A senha deve ter ao menos um número.' }],
      })
    })

    it('aceiteTermos false → 400 (critério 4)', async () => {
      const resposta = await cadastrar({ ...VALIDO, aceiteTermos: false })
      expect(resposta.status).toBe(400)
      expect(resposta.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ field: 'aceiteTermos' }],
      })
    })

    it('campo extra papel → 400 (mass assignment)', async () => {
      const resposta = await cadastrar({ ...VALIDO, papel: 'ADMINISTRADOR' })
      expect(resposta.status).toBe(400)
      expect(resposta.body).toMatchObject({ code: 'VALIDATION_ERROR' })
      await expect(contarLinhas()).resolves.toMatchObject({ usuarios: 0 })
    })
  })

  it('versão dos termos diferente da vigente → 409 TERMOS_DESATUALIZADOS (critério 5)', async () => {
    const resposta = await cadastrar({ ...VALIDO, versaoTermos: '2000-01-01' })
    expect(resposta.status).toBe(409)
    expect(resposta.body).toMatchObject({ code: 'TERMOS_DESATUALIZADOS' })
    await expect(contarLinhas()).resolves.toMatchObject({ usuarios: 0 })
  })

  it('11º cadastro do mesmo IP na hora → 429 com Retry-After; outro IP segue liberado', async () => {
    for (let i = 1; i <= 10; i++) {
      const resposta = await cadastrar({ ...VALIDO, email: `pessoa${i}@ex.com` }, '10.0.0.9')
      expect(resposta.status).toBe(201)
    }

    const bloqueado = await cadastrar({ ...VALIDO, email: 'pessoa11@ex.com' }, '10.0.0.9')
    expect(bloqueado.status).toBe(429)
    expect(bloqueado.body).toMatchObject({ code: 'RATE_LIMITED' })
    expect(Number(bloqueado.headers['retry-after'])).toBeGreaterThan(3500)
    expect(Number(bloqueado.headers['retry-after'])).toBeLessThanOrEqual(3600)

    const outroIp = await cadastrar({ ...VALIDO, email: 'pessoa11@ex.com' }, '10.0.0.10')
    expect(outroIp.status).toBe(201)
  })
})
