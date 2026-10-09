import {
  respostaEnvioVerificacaoSchema,
  TERMOS_VERSAO,
  VALIDADE_CODIGO_VERIFICACAO_MS,
} from '@atletica/shared'
import * as Sentry from '@sentry/nestjs'
import request from 'supertest'
import { HORA_MS, MINUTO_MS } from '../../src/common/tempo'
import { EmailProvider } from '../../src/infra/email/email-provider'
import type { FakeEmailProvider } from '../../src/infra/email/providers/fake-email.provider'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { TipoTentativa } from '../../src/modules/auth/rate-limit.service'
import { VerificacaoEmailService } from '../../src/modules/auth/verificacao-email/verificacao-email.service'
import { aguardarOuvintes } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }))

const ENVIAR = '/api/v1/auth/verificar-email/enviar'
const VERIFICAR = '/api/v1/auth/verificar-email'

const CADASTRO = {
  nome: 'Ana Souza',
  email: 'ana@ex.com',
  senha: 'lorde2026',
  aceiteTermos: true,
  versaoTermos: TERMOS_VERSAO,
}

describe('Verificação de e-mail (#31)', () => {
  let contexto: AppDeTeste
  let padraoId: string
  let email: FakeEmailProvider
  let enviarCodigo: jest.SpiedFunction<VerificacaoEmailService['enviarCodigo']>

  async function como(usuario: UsuarioCriado) {
    const token = await tokenPara(usuario)
    const autenticar = (teste: request.Test) => teste.set('Authorization', `Bearer ${token}`)
    return {
      enviar: () => autenticar(request(contexto.http).post(ENVIAR)),
      verificar: (codigo: string) =>
        autenticar(request(contexto.http).post(VERIFICAR).send({ codigo })),
    }
  }

  function ultimoCodigo(): string {
    const [codigo] = /\b\d{6}\b/.exec(email.ultimos().at(-1)?.texto ?? '') ?? []
    if (!codigo) throw new Error('nenhum código enviado')
    return codigo
  }

  const usuarioNaPadrao = () => criarUsuario({ atleticaId: padraoId, email: 'ana@gmail.com' })
  const codigosDe = (usuarioId: string) =>
    prismaTeste.codigoVerificacao.findMany({ where: { usuarioId, tipo: 'VERIFICAR_EMAIL' } })

  /** Envios anteriores registrados no limite (sem esperar o relógio). */
  const enviosAnteriores = (usuarioId: string, ...minutosAtras: number[]) =>
    prismaTeste.tentativaAcesso.createMany({
      data: minutosAtras.map((minutos) => ({
        tipo: TipoTentativa.VERIFICACAO_ENVIO,
        chave: usuarioId,
        criadoEm: new Date(Date.now() - minutos * MINUTO_MS),
      })),
    })

  /** O ouvinte é assíncrono e faz várias consultas: espera o envio terminar. */
  async function aguardarEnvioDoCadastro(): Promise<void> {
    while (enviarCodigo.mock.calls.length === 0) await aguardarOuvintes()
    await enviarCodigo.mock.results[0]?.value
  }

  beforeAll(async () => {
    contexto = await criarApp()
    padraoId = contexto.app.get(AtleticaPadraoService).id()
    email = contexto.app.get<FakeEmailProvider>(EmailProvider)
    enviarCodigo = jest.spyOn(contexto.app.get(VerificacaoEmailService), 'enviarCodigo')
  })

  beforeEach(async () => {
    await criarAtletica({ id: padraoId, nome: 'Atlética Teste', sigla: 'ATT' })
    email.limpar()
    enviarCodigo.mockClear()
    jest.mocked(Sentry.captureException).mockClear()
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  describe('envio no cadastro', () => {
    const cadastrar = () => request(contexto.http).post('/api/v1/auth/cadastro').send(CADASTRO)

    it('cadastro → 1 código VERIFICAR_EMAIL e 1 e-mail com os dados da atlética (critérios 1 e 12)', async () => {
      const resposta = await cadastrar()
      expect(resposta.status).toBe(201)
      await aguardarEnvioDoCadastro()

      const usuario = await prismaTeste.usuario.findUniqueOrThrow({
        where: { email: CADASTRO.email },
      })
      expect(usuario.emailVerificado).toBe(false)
      expect(await codigosDe(usuario.id)).toHaveLength(1)

      const enviados = email.ultimos()
      expect(enviados).toHaveLength(1)
      expect(enviados[0]).toMatchObject({
        para: CADASTRO.email,
        assunto: 'ATT: confirme seu e-mail',
      })
      for (const corpo of [enviados[0]?.html, enviados[0]?.texto]) {
        expect(corpo).toContain('Atlética Teste')
        expect(corpo).toContain(ultimoCodigo())
        expect(corpo).toContain('24 horas')
        expect(corpo).toContain('Se você não criou esta conta, ignore este e-mail.')
      }
    })

    it('provedor de e-mail falhando → cadastro 201 e erro no Sentry (critério 2)', async () => {
      const falha = new Error('Resend fora do ar')
      email.simularFalha(falha)

      const resposta = await cadastrar()
      await aguardarEnvioDoCadastro()

      expect(resposta.status).toBe(201)
      expect(email.ultimos()).toEqual([])
      expect(Sentry.captureException).toHaveBeenCalledWith(
        falha,
        expect.objectContaining({ tags: { modulo: 'email' } }),
      )
      const usuario = await prismaTeste.usuario.findUniqueOrThrow({
        where: { email: CADASTRO.email },
      })
      expect(usuario.emailVerificado).toBe(false)
    })
  })

  describe('POST /auth/verificar-email/enviar', () => {
    it('202 com e-mail mascarado, validade de 24 h e próximo envio em 60 s', async () => {
      const usuario = await usuarioNaPadrao()
      const antes = Date.now()

      const resposta = await (await como(usuario)).enviar()

      expect(resposta.status).toBe(202)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const corpo = respostaEnvioVerificacaoSchema.parse(resposta.body)
      expect(corpo.enviadoPara).toBe('a***@gmail.com')
      expect(Date.parse(corpo.expiraEm) - antes).toBeGreaterThanOrEqual(
        VALIDADE_CODIGO_VERIFICACAO_MS,
      )
      expect(Date.parse(corpo.proximoEnvioEm) - antes).toBeGreaterThanOrEqual(MINUTO_MS)
      expect(email.ultimos()).toHaveLength(1)
    })

    it('envio há menos de 60 s → 429 com proximoEnvioEm (critério 8)', async () => {
      const usuario = await usuarioNaPadrao()
      await enviosAnteriores(usuario.id, 0.5)

      const resposta = await (await como(usuario)).enviar()

      expect(resposta.status).toBe(429)
      const { code, details } = resposta.body as { code: string; details: { field: string }[] }
      expect(code).toBe('RATE_LIMITED')
      expect(details.map(({ field }) => field)).toEqual(['proximoEnvioEm'])
      expect(Number(resposta.headers['retry-after'])).toBeLessThanOrEqual(30)
      expect(email.ultimos()).toEqual([])
    })

    it('4º envio na mesma hora → 429 até 1 h depois do 1º (critério 7)', async () => {
      const usuario = await usuarioNaPadrao()
      await enviosAnteriores(usuario.id, 50, 30, 10)

      const resposta = await (await como(usuario)).enviar()

      expect(resposta.status).toBe(429)
      const [detalhe] = (resposta.body as { details: { message: string }[] }).details
      const esperado = Date.now() - 50 * MINUTO_MS + HORA_MS
      expect(Math.abs(Date.parse(detalhe?.message ?? '') - esperado)).toBeLessThan(5_000)
    })

    it('já verificado → 409 EMAIL_JA_VERIFICADO sem e-mail (critério 10)', async () => {
      const usuario = await usuarioNaPadrao()
      await prismaTeste.usuario.update({
        where: { id: usuario.id },
        data: { emailVerificado: true },
      })

      const resposta = await (await como(usuario)).enviar()

      expect(resposta.status).toBe(409)
      expect(resposta.body).toMatchObject({ code: 'EMAIL_JA_VERIFICADO' })
      expect(email.ultimos()).toEqual([])
    })
  })

  describe('POST /auth/verificar-email', () => {
    it('código correto → 200 e emailVerificado; repetir é idempotente (critérios 3 e 7)', async () => {
      const usuario = await usuarioNaPadrao()
      const api = await como(usuario)
      await api.enviar()

      const resposta = await api.verificar(ultimoCodigo())

      expect(resposta.status).toBe(200)
      expect(resposta.body).toStrictEqual({ emailVerificado: true })
      const atualizado = await prismaTeste.usuario.findUniqueOrThrow({ where: { id: usuario.id } })
      expect(atualizado.emailVerificado).toBe(true)
      expect((await api.verificar(ultimoCodigo())).body).toStrictEqual({ emailVerificado: true })
    })

    it('código usado → 400 CODIGO_EXPIRADO', async () => {
      const usuario = await usuarioNaPadrao()
      const api = await como(usuario)
      await api.enviar()
      const codigo = ultimoCodigo()
      await prismaTeste.codigoVerificacao.updateMany({
        where: { usuarioId: usuario.id },
        data: { usadoEm: new Date() },
      })

      const resposta = await api.verificar(codigo)

      expect(resposta.status).toBe(400)
      expect(resposta.body).toMatchObject({ code: 'CODIGO_EXPIRADO' })
    })

    it('código errado → 400 CODIGO_INVALIDO (critério 4)', async () => {
      const usuario = await usuarioNaPadrao()
      const api = await como(usuario)
      await api.enviar()
      const errado = ultimoCodigo() === '000000' ? '000001' : '000000'

      const resposta = await api.verificar(errado)

      expect(resposta.status).toBe(400)
      expect(resposta.body).toMatchObject({ code: 'CODIGO_INVALIDO' })
      expect((await codigosDe(usuario.id))[0]?.tentativas).toBe(1)
    })

    it('código com mais de 24 h → 400 CODIGO_EXPIRADO (critério 5)', async () => {
      const usuario = await usuarioNaPadrao()
      const api = await como(usuario)
      await api.enviar()
      await prismaTeste.codigoVerificacao.updateMany({
        where: { usuarioId: usuario.id },
        data: { expiraEm: new Date(Date.now() - 1) },
      })

      const resposta = await api.verificar(ultimoCodigo())

      expect(resposta.body).toMatchObject({ code: 'CODIGO_EXPIRADO' })
    })

    it('formato inválido → 400 VALIDATION_ERROR', async () => {
      const usuario = await usuarioNaPadrao()

      const resposta = await (await como(usuario)).verificar('12345')

      expect(resposta.status).toBe(400)
      expect(resposta.body).toMatchObject({ code: 'VALIDATION_ERROR' })
    })
  })

  it.each([ENVIAR, VERIFICAR])('%s sem token → 401 UNAUTHENTICATED (critério 11)', async (rota) => {
    const resposta = await request(contexto.http).post(rota).send({ codigo: '123456' })

    expect(resposta.status).toBe(401)
    expect(resposta.body).toMatchObject({ code: 'UNAUTHENTICATED' })
  })
})
