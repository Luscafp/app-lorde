import { NIVEL_PAPEL, Papel } from '@atletica/shared'
import request from 'supertest'
import { criarSessao, tokenPara } from '../fabricas/auth'
import { criarAtletica } from '../fabricas/atletica'
import { proximaSequencia } from '../fabricas/sequencia'
import { assinarToken } from '../fabricas/token'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'
import { AuthTesteController } from '../suporte/auth.controller'

const BASE = '/api/v1/teste-auth'
const NAO_AUTENTICADO = {
  statusCode: 401,
  code: 'UNAUTHENTICATED',
  message: 'Sessão inválida. Entre novamente.',
  details: [],
}
const PROIBIDO = {
  statusCode: 403,
  code: 'FORBIDDEN',
  message: 'Você não tem permissão para esta ação.',
  details: [],
}

const ROTAS_POR_NIVEL = [
  ['livre', Papel.ATLETA],
  ['diretoria', Papel.DIRETOR],
  ['presidencia', Papel.PRESIDENTE],
  ['administracao', Papel.ADMINISTRADOR],
] as const

// TODO: trocar pelas fábricas de domínio quando existirem (times → #63, eventos → #70).
async function criarTime(atleticaId: string) {
  const modalidade = await prismaTeste.modalidade.create({
    data: { nome: `Modalidade ${proximaSequencia()}`, icone: 'bola' },
  })
  return prismaTeste.time.create({
    data: { atleticaId, modalidadeId: modalidade.id, nome: `Time ${proximaSequencia()}` },
  })
}

async function criarTreino(atleticaId: string, criadoPorId: string) {
  const time = await criarTime(atleticaId)
  return prismaTeste.evento.create({
    data: {
      atleticaId,
      tipo: 'TREINO',
      timeId: time.id,
      inicio: new Date('2026-11-10T19:00:00Z'),
      local: 'Ginásio',
      criadoPorId,
    },
  })
}

describe('Autenticação e autorização (#7)', () => {
  let contexto: AppDeTeste

  const get = (rota: string, token?: string) => {
    const req = request(contexto.http).get(`${BASE}/${rota}`)
    return token ? req.set('Authorization', `Bearer ${token}`) : req
  }

  beforeAll(async () => {
    contexto = await criarApp({ controllers: [AuthTesteController] })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  describe('negação por padrão', () => {
    it('rota sem decorator e sem token → 401 UNAUTHENTICATED (critério 1)', async () => {
      const resposta = await get('livre')
      expect(resposta.status).toBe(401)
      expect(resposta.body).toEqual(NAO_AUTENTICADO)
    })

    it('rota @Publico() sem token responde normalmente, sem usuário nem contexto (critério 2)', async () => {
      const resposta = await get('publica')
      expect(resposta.status).toBe(200)
      expect(resposta.body).toEqual({ ok: true, usuario: null, atleticaId: null })
    })

    it('rota @Publico() ignora token inválido', async () => {
      expect((await get('publica', 'lixo')).status).toBe(200)
    })

    it.each([
      ['esquema diferente de Bearer', (t: string) => `Basic ${t}`],
      ['Bearer sem token', () => 'Bearer '],
      ['token malformado', () => 'Bearer nao.e.jwt'],
    ])('%s → 401', async (_, cabecalho) => {
      const usuario = await criarUsuario()
      const token = await tokenPara(usuario)
      const resposta = await request(contexto.http)
        .get(`${BASE}/livre`)
        .set('Authorization', cabecalho(token))
      expect(resposta.body).toEqual(NAO_AUTENTICADO)
    })
  })

  describe('token', () => {
    let usuario: UsuarioCriado
    let sid: string

    beforeEach(async () => {
      usuario = await criarUsuario()
      sid = (await criarSessao({ usuarioId: usuario.id, atleticaId: usuario.atleticaId })).id
    })

    const payload = () => ({ sub: usuario.id, atl: usuario.atleticaId, sid })

    it('token válido → 200', async () => {
      expect((await get('livre', assinarToken(payload()))).status).toBe(200)
    })

    it.each([
      ['assinado com outro segredo', () => assinarToken(payload(), { secret: 'x'.repeat(32) })],
      ['com algoritmo HS512', () => assinarToken(payload(), { algorithm: 'HS512' })],
      [
        'com alg none',
        () => {
          const codificar = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
          const agora = Math.floor(Date.now() / 1000)
          return `${codificar({ alg: 'none', typ: 'JWT' })}.${codificar({
            ...payload(),
            iat: agora,
            exp: agora + 900,
            iss: 'atletica-api',
            aud: 'atletica-app',
          })}.`
        },
      ],
      ['sem atl', () => assinarToken({ sub: usuario.id, sid })],
      ['com sub fora do formato', () => assinarToken({ ...payload(), sub: 'abc' })],
      ['sem iss', () => assinarToken(payload(), { issuer: undefined })],
      ['sem aud', () => assinarToken(payload(), { audience: undefined })],
      ['com iss diferente', () => assinarToken(payload(), { issuer: 'outra-api' })],
      ['com aud diferente', () => assinarToken(payload(), { audience: 'outro-app' })],
    ])('token %s → 401 UNAUTHENTICATED (critério 3)', async (_, gerar) => {
      const resposta = await get('livre', gerar())
      expect(resposta.status).toBe(401)
      expect(resposta.body).toEqual(NAO_AUTENTICADO)
    })

    it('vencido há 1 min → 401 TOKEN_EXPIRED; há 5 s ou 10 s → aceito (critério 4)', async () => {
      const agora = Math.floor(Date.now() / 1000)
      const vencidoHa = (segundos: number) =>
        assinarToken(
          { ...payload(), iat: agora - 900, exp: agora - segundos },
          { expiresIn: undefined },
        )

      const expirado = await get('livre', vencidoHa(60))
      expect(expirado.status).toBe(401)
      expect(expirado.body).toEqual({
        statusCode: 401,
        code: 'TOKEN_EXPIRED',
        message: 'Sessão expirada.',
        details: [],
      })
      expect((await get('livre', vencidoHa(5))).status).toBe(200)
      expect((await get('livre', vencidoHa(10))).status).toBe(200)
    })
  })

  describe('sessão e conta', () => {
    it('sessão revogada → 401 imediatamente, mesmo com o token válido (critério 5)', async () => {
      const usuario = await criarUsuario()
      const sessao = await criarSessao({ usuarioId: usuario.id, atleticaId: usuario.atleticaId })
      const token = await tokenPara(usuario, { sessao })
      expect((await get('livre', token)).status).toBe(200)

      await prismaTeste.sessao.update({
        where: { id: sessao.id },
        data: { revogadaEm: new Date(), motivoRevogacao: 'LOGOUT' },
      })
      expect((await get('livre', token)).body).toEqual(NAO_AUTENTICADO)
    })

    it('sessão expirada → 401', async () => {
      const usuario = await criarUsuario()
      const sessao = await criarSessao({
        usuarioId: usuario.id,
        atleticaId: usuario.atleticaId,
        expiraEm: new Date(Date.now() - 1000),
      })
      expect((await get('livre', await tokenPara(usuario, { sessao }))).body).toEqual(
        NAO_AUTENTICADO,
      )
    })

    it('sessão inexistente → 401', async () => {
      const usuario = await criarUsuario()
      const token = await tokenPara(usuario, { sessao: { id: crypto.randomUUID() } })
      expect((await get('livre', token)).body).toEqual(NAO_AUTENTICADO)
    })

    it('sid de outro usuário → 401', async () => {
      const dono = await criarUsuario()
      const intruso = await criarUsuario({ atleticaId: dono.atleticaId })
      const sessao = await criarSessao({ usuarioId: dono.id, atleticaId: dono.atleticaId })
      expect((await get('livre', await tokenPara(intruso, { sessao }))).body).toEqual(
        NAO_AUTENTICADO,
      )
    })

    it('sessão de outra atlética que a do token → 401', async () => {
      const usuario = await criarUsuario()
      const outra = await criarAtletica()
      await prismaTeste.vinculoAtletica.create({
        data: { usuarioId: usuario.id, atleticaId: outra.id },
      })
      const sessao = await criarSessao({ usuarioId: usuario.id, atleticaId: usuario.atleticaId })
      const token = await tokenPara(usuario, { sessao, atleticaId: outra.id })
      expect((await get('livre', token)).body).toEqual(NAO_AUTENTICADO)
    })

    it('vínculo desativado pela Presidência → 401 CONTA_DESATIVADA (critério 6)', async () => {
      const usuario = await criarUsuario()
      const token = await tokenPara(usuario)
      await prismaTeste.vinculoAtletica.update({
        where: { id: usuario.vinculo.id },
        data: { ativo: false },
      })
      expect((await get('livre', token)).body).toEqual({
        statusCode: 401,
        code: 'CONTA_DESATIVADA',
        message: 'Sua conta está desativada. Procure a diretoria.',
        details: [],
      })
    })

    it('token com atl de atlética sem vínculo → 401 (critério 11)', async () => {
      const usuario = await criarUsuario()
      const outra = await criarAtletica()
      expect((await get('livre', await tokenPara(usuario, { atleticaId: outra.id }))).body).toEqual(
        NAO_AUTENTICADO,
      )
    })

    it('conta excluída → 401 UNAUTHENTICATED, mesmo com vínculo inativo (critério 17)', async () => {
      const usuario = await criarUsuario({ vinculoAtivo: false })
      const token = await tokenPara(usuario)
      await prismaTeste.usuario.update({
        where: { id: usuario.id },
        data: { excluidoEm: new Date() },
      })
      expect((await get('livre', token)).body).toEqual(NAO_AUTENTICADO)
    })

    it('Usuario.ativo = false → 401 UNAUTHENTICATED', async () => {
      const usuario = await criarUsuario({ ativo: false })
      expect((await get('livre', await tokenPara(usuario))).body).toEqual(NAO_AUTENTICADO)
    })
  })

  describe('papéis', () => {
    const casos = Object.values(Papel).flatMap((papel) =>
      ROTAS_POR_NIVEL.map(
        ([rota, minimo]) => [papel, rota, NIVEL_PAPEL[papel] >= NIVEL_PAPEL[minimo]] as const,
      ),
    )

    it.each(casos)(
      '%s em /%s → permitido: %s (critérios 8 a 10)',
      async (papel, rota, permitido) => {
        const usuario = await criarUsuario({ papel })
        const resposta = await get(rota, await tokenPara(usuario))
        expect(resposta.status).toBe(permitido ? 200 : 403)
        if (!permitido) expect(resposta.body).toEqual(PROIBIDO)
      },
    )

    it('mudança de papel vale na requisição seguinte com o mesmo token (critério 7)', async () => {
      const usuario = await criarUsuario({ papel: 'DIRETOR' })
      const token = await tokenPara(usuario)
      expect((await get('diretoria', token)).status).toBe(200)

      await prismaTeste.vinculoAtletica.update({
        where: { id: usuario.vinculo.id },
        data: { papel: 'ATLETA' },
      })
      expect((await get('diretoria', token)).body).toEqual(PROIBIDO)

      await prismaTeste.vinculoAtletica.update({
        where: { id: usuario.vinculo.id },
        data: { papel: 'ADMINISTRADOR' },
      })
      expect((await get('administracao', token)).status).toBe(200)
    })

    it('sem token, rota com @PapelMinimo → 401 (não 403)', async () => {
      expect((await get('diretoria')).body).toEqual(NAO_AUTENTICADO)
    })
  })

  describe('decorators e contexto', () => {
    it('@UsuarioAtual() e @AtleticaAtual() recebem os dados do token e do banco (critério 13)', async () => {
      const usuario = await criarUsuario({ papel: 'VICE_PRESIDENTE', nome: 'Ana' })
      const sessao = await criarSessao({ usuarioId: usuario.id, atleticaId: usuario.atleticaId })
      const resposta = await get('eu', await tokenPara(usuario, { sessao }))

      expect(resposta.status).toBe(200)
      expect(resposta.body).toEqual({
        usuario: {
          id: usuario.id,
          nome: 'Ana',
          email: usuario.email,
          atleticaId: usuario.atleticaId,
          sessaoId: sessao.id,
          papel: 'VICE_PRESIDENTE',
          nivel: 3,
        },
        papel: 'VICE_PRESIDENTE',
        atleticaId: usuario.atleticaId,
        contexto: { atleticaId: usuario.atleticaId, usuarioId: usuario.id },
      })
    })

    it('@AtleticaAtual() em rota @Publico() é erro de programação → 500', async () => {
      const resposta = await get('publica-com-atletica')
      expect(resposta.status).toBe(500)
      expect(resposta.body).toMatchObject({ code: 'INTERNAL_ERROR' })
    })

    it('o guard não escreve na sessão', async () => {
      const usuario = await criarUsuario()
      const sessao = await criarSessao({ usuarioId: usuario.id, atleticaId: usuario.atleticaId })
      await get('livre', await tokenPara(usuario, { sessao }))
      expect(await prismaTeste.sessao.findUnique({ where: { id: sessao.id } })).toEqual(sessao)
    })
  })

  describe('multi-atlética', () => {
    it('registro de outra atlética → 404; da própria → 200 (critério 12)', async () => {
      const usuarioA = await criarUsuario()
      const usuarioB = await criarUsuario()
      const eventoA = await criarTreino(usuarioA.atleticaId, usuarioA.id)
      const eventoB = await criarTreino(usuarioB.atleticaId, usuarioB.id)
      const token = await tokenPara(usuarioA)

      expect((await get(`eventos/${eventoA.id}`, token)).status).toBe(200)
      const resposta = await get(`eventos/${eventoB.id}`, token)
      expect(resposta.status).toBe(404)
      expect(resposta.body).toMatchObject({ code: 'NOT_FOUND' })
    })

    it('time de adversária sem app é lido; de outra atlética com app → 404 (critério 16)', async () => {
      const usuario = await criarUsuario()
      const adversaria = await criarAtletica({ usaAplicativo: false })
      const timeAdversario = await criarTime(adversaria.id)
      const timeOutra = await criarTime((await criarAtletica()).id)
      const token = await tokenPara(usuario)

      expect((await get(`times/${timeAdversario.id}`, token)).body).toMatchObject({
        id: timeAdversario.id,
      })
      expect((await get(`times/${timeOutra.id}`, token)).status).toBe(404)
    })
  })

  describe('Swagger (critério 15)', () => {
    it('rotas protegidas têm cadeado e 401/403; a pública não', async () => {
      const resposta = await request(contexto.http).get('/api/docs-json')
      const doc = resposta.body as { paths: Record<string, { get: Record<string, unknown> }> }
      const operacao = (rota: string) => doc.paths[`${BASE}/${rota}`]?.get

      expect(operacao('livre')).toMatchObject({
        security: [{ bearer: [] }],
        responses: { 401: expect.any(Object) as object },
      })
      expect(operacao('diretoria')).toMatchObject({
        security: [{ bearer: [] }],
        responses: { 401: expect.any(Object) as object, 403: expect.any(Object) as object },
      })
      const publica = operacao('publica')
      expect(publica).toBeDefined()
      expect(publica).not.toHaveProperty('security')
      expect(publica).not.toHaveProperty('x-publico')
      expect(publica?.responses).not.toHaveProperty('401')
    })
  })
})
