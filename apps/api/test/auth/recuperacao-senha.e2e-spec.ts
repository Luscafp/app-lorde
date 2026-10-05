import { performance } from 'node:perf_hooks'
import { MENSAGEM_RECUPERACAO_ENVIADA, VALIDADE_CODIGO_MS } from '@atletica/shared'
import { Logger } from '@nestjs/common'
import request from 'supertest'
import { CodigoVerificacaoService } from '../../src/infra/email/codigo-verificacao'
import { EmailProvider } from '../../src/infra/email/email-provider'
import type { FakeEmailProvider } from '../../src/infra/email/providers/fake-email.provider'
import { TransacaoService } from '../../src/infra/eventos/apos-commit'
import { SenhaService } from '../../src/infra/senha/senha.service'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { RateLimitService } from '../../src/modules/auth/rate-limit.service'
import { MAXIMO_TENTATIVAS_CODIGO } from '../../src/modules/auth/recuperacao-senha.service'
import { SessaoService } from '../../src/modules/auth/sessao.service'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { criarUsuario, type DadosUsuario } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ESQUECI = '/api/v1/auth/senha/esqueci'
const VERIFICAR = '/api/v1/auth/senha/verificar-codigo'
const REDEFINIR = '/api/v1/auth/senha/redefinir'
const SENHA = 'lorde2026'
const NOVA_SENHA = 'novaSenha9'
const EMAIL = 'ana@ex.com'
const IP = '10.0.0.1'

const CODIGO_INVALIDO = {
  statusCode: 400,
  code: 'CODIGO_INVALIDO',
  message: 'Código inválido ou expirado.',
  details: [],
}

describe('Recuperação de senha (#62)', () => {
  let contexto: AppDeTeste
  let padraoId: string
  let senhaHash: string
  let email: FakeEmailProvider
  let eventos: EspiaoEventos

  const post = (rota: string, corpo: object, ip = IP) =>
    request(contexto.http).post(rota).set('X-Forwarded-For', ip).send(corpo)
  const pedir = (endereco = EMAIL, ip = IP) => post(ESQUECI, { email: endereco }, ip)
  const verificar = (codigo: string, endereco = EMAIL, ip = IP) =>
    post(VERIFICAR, { email: endereco, codigo }, ip)
  const redefinir = (codigo: string, novaSenha = NOVA_SENHA, endereco = EMAIL) =>
    post(REDEFINIR, { email: endereco, codigo, novaSenha })
  const entrar = (senha: string) =>
    request(contexto.http).post('/api/v1/auth/login').set('X-Forwarded-For', IP).send({
      email: EMAIL,
      senha,
    })

  const criarConta = (dados: DadosUsuario = {}) =>
    criarUsuario({ email: EMAIL, senhaHash, atleticaId: padraoId, ...dados })

  /** Último código enviado ao `FakeEmailProvider`. */
  function ultimoCodigo(): string {
    const texto = email.ultimos().at(-1)?.texto ?? ''
    const [codigo] = /\b\d{6}\b/.exec(texto) ?? []
    if (!codigo) throw new Error('nenhum código enviado')
    return codigo
  }

  async function pedirCodigo(): Promise<string> {
    expect((await pedir()).status).toBe(202)
    return ultimoCodigo()
  }

  const codigosDoUsuario = (usuarioId: string) =>
    prismaTeste.codigoVerificacao.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'asc' } })

  async function abrirSessao(usuarioId: string) {
    return contexto.app
      .get(TransacaoService)
      .executar((tx) =>
        contexto.app.get(SessaoService).criar(tx, { usuarioId, atleticaId: padraoId }),
      )
  }

  beforeAll(async () => {
    contexto = await criarApp()
    padraoId = contexto.app.get(AtleticaPadraoService).id()
    senhaHash = await contexto.app.get(SenhaService).hash(SENHA)
    email = contexto.app.get<FakeEmailProvider>(EmailProvider)
  })

  beforeEach(async () => {
    await criarAtletica({ id: padraoId, nome: 'Atlética Teste', sigla: 'ATT' })
    email.limpar()
    eventos = espiarEventos(contexto.app)
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  describe('POST /auth/senha/esqueci', () => {
    it('feliz: e-mail com espaços e outra caixa → 202, código com HMAC válido por 15 min e 1 e-mail (critério 1)', async () => {
      const usuario = await criarConta()

      const resposta = await pedir('ANA@ex.com ')

      expect(resposta.status).toBe(202)
      expect(resposta.body).toStrictEqual({ message: MENSAGEM_RECUPERACAO_ENVIADA })
      expect(resposta.headers['cache-control']).toBe('no-store')

      const enviados = email.ultimos()
      expect(enviados).toHaveLength(1)
      expect(enviados[0]).toMatchObject({
        para: EMAIL,
        assunto: 'Seu código para redefinir a senha — ATT',
      })
      const codigo = ultimoCodigo()

      const [registro] = await codigosDoUsuario(usuario.id)
      expect(registro).toMatchObject({ tipo: 'RECUPERAR_SENHA', tentativas: 0, usadoEm: null })
      expect(registro?.codigoHash).toBe(
        contexto.app.get(CodigoVerificacaoService).hashCodigo(usuario.id, codigo),
      )
      expect(registro?.codigoHash).not.toContain(codigo)
      expect((registro?.expiraEm.getTime() ?? 0) - (registro?.criadoEm.getTime() ?? 0)).toBeCloseTo(
        VALIDADE_CODIGO_MS,
        -2,
      )
    })

    it('e-mail inexistente → 202 com o mesmo corpo, sem código e sem e-mail (critério 2)', async () => {
      await criarConta()
      const existente = await pedir()
      email.limpar()

      const resposta = await pedir('nao@ex.com')

      expect(resposta.status).toBe(202)
      expect(resposta.body).toStrictEqual(existente.body)
      expect(email.ultimos()).toEqual([])
      expect(await prismaTeste.codigoVerificacao.count()).toBe(1)
    })

    it('tempo de resposta não revela a existência do e-mail (critério 2)', async () => {
      await criarConta({ email: 'aquecimento@ex.com' })
      await pedir('aquecimento@ex.com', '10.1.0.0')
      const medir = async (endereco: string, ip: string) => {
        const inicio = performance.now()
        await pedir(endereco, ip)
        return performance.now() - inicio
      }

      const existentes: number[] = []
      const inexistentes: number[] = []
      for (let i = 1; i <= 5; i++) {
        await criarConta({ email: `conta${i}@ex.com` })
        existentes.push(await medir(`conta${i}@ex.com`, `10.1.0.${i}`))
        inexistentes.push(await medir(`nao${i}@ex.com`, `10.2.0.${i}`))
      }

      const media = (valores: number[]) => valores.reduce((a, b) => a + b, 0) / valores.length
      expect(Math.abs(media(existentes) - media(inexistentes))).toBeLessThan(50)
    })

    it.each<[string, DadosUsuario]>([
      ['conta desativada', { ativo: false }],
      ['vínculo desativado (RN36)', { vinculoAtivo: false }],
    ])('%s → 202 neutro e nenhum envio (critério 3)', async (_caso, dados) => {
      await criarConta(dados)

      const resposta = await pedir()

      expect(resposta.status).toBe(202)
      expect(resposta.body).toStrictEqual({ message: MENSAGEM_RECUPERACAO_ENVIADA })
      expect(email.ultimos()).toEqual([])
      expect(await prismaTeste.codigoVerificacao.count()).toBe(0)
    })

    it('conta excluída → 202 neutro e nenhum envio (critério 3)', async () => {
      await criarConta()
      await prismaTeste.usuario.updateMany({ data: { excluidoEm: new Date() } })

      expect((await pedir()).status).toBe(202)
      expect(email.ultimos()).toEqual([])
    })

    it.each([
      ['existente', true],
      ['inexistente', false],
    ])('e-mail %s: 4º pedido na hora → 429 com Retry-After (critério 4)', async (_caso, existe) => {
      if (existe) await criarConta()
      for (let i = 0; i < 3; i++) expect((await pedir(EMAIL, `10.0.1.${i}`)).status).toBe(202)

      const bloqueado = await pedir(EMAIL, '10.0.1.9')

      expect(bloqueado.status).toBe(429)
      expect(bloqueado.body).toMatchObject({
        code: 'RATE_LIMITED',
        message: 'Limite de 3 envios por hora atingido. Tente novamente em 60 min.',
      })
      expect(Number(bloqueado.headers['retry-after'])).toBeGreaterThan(3500)
      expect(Number(bloqueado.headers['retry-after'])).toBeLessThanOrEqual(3600)
      expect(email.ultimos()).toHaveLength(existe ? 3 : 0)
    })

    it('11º pedido do mesmo IP na hora → 429; o limite por e-mail não é afetado', async () => {
      for (let i = 0; i < 10; i++) expect((await pedir(`nao${i}@ex.com`)).status).toBe(202)

      expect((await pedir('outro@ex.com')).status).toBe(429)
      expect((await pedir('outro@ex.com', '10.0.0.2')).status).toBe(202)
    })

    it('formato inválido → 400 VALIDATION_ERROR sem contar no limite', async () => {
      const resposta = await pedir('ana@')

      expect(resposta.status).toBe(400)
      expect(resposta.body).toMatchObject({ code: 'VALIDATION_ERROR' })
      expect(await prismaTeste.tentativaAcesso.count()).toBe(0)
    })

    it('provedor falhando → ainda 202, erro logado com e-mail mascarado', async () => {
      await criarConta()
      email.simularFalha(new Error('Resend fora do ar'))
      const logErro = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

      try {
        const resposta = await pedir()
        await aguardarOuvintes()

        expect(resposta.status).toBe(202)
        expect(logErro).toHaveBeenCalledWith(
          expect.objectContaining({ para: 'a***@ex.com' }),
          'Falha ao enviar e-mail',
        )
      } finally {
        logErro.mockRestore()
      }
    })
  })

  describe('POST /auth/senha/verificar-codigo', () => {
    it('código correto → 200 { valido: true } sem consumir (critério 5)', async () => {
      const usuario = await criarConta()
      const codigo = await pedirCodigo()

      const resposta = await verificar(codigo)

      expect(resposta.status).toBe(200)
      expect(resposta.body).toStrictEqual({ valido: true })
      expect(await codigosDoUsuario(usuario.id)).toEqual([
        expect.objectContaining({ usadoEm: null, tentativas: 0 }),
      ])
      expect((await verificar(codigo)).status).toBe(200)
    })

    it(`código errado → 400 e conta tentativa; na ${MAXIMO_TENTATIVAS_CODIGO}ª até o correto falha (critério 6)`, async () => {
      const usuario = await criarConta()
      const codigo = await pedirCodigo()
      const errado = codigo === '000000' ? '000001' : '000000'

      const resposta = await verificar(errado)
      expect(resposta.status).toBe(400)
      expect(resposta.body).toStrictEqual(CODIGO_INVALIDO)
      expect((await codigosDoUsuario(usuario.id))[0]?.tentativas).toBe(1)

      for (let i = 2; i < MAXIMO_TENTATIVAS_CODIGO; i++) await verificar(errado)
      expect((await verificar(codigo)).status).toBe(200)

      await verificar(errado)
      const [registro] = await codigosDoUsuario(usuario.id)
      expect(registro?.tentativas).toBe(MAXIMO_TENTATIVAS_CODIGO)
      expect(registro?.expiraEm.getTime()).toBeLessThanOrEqual(Date.now())
      expect((await verificar(codigo)).body).toStrictEqual(CODIGO_INVALIDO)
    })

    it('código expirado → 400 CODIGO_INVALIDO (critério 7)', async () => {
      await criarConta()
      const codigo = await pedirCodigo()
      await prismaTeste.codigoVerificacao.updateMany({ data: { expiraEm: new Date() } })

      expect((await verificar(codigo)).body).toStrictEqual(CODIGO_INVALIDO)
    })

    it('código do pedido anterior → 400; o mais recente funciona (critério 8)', async () => {
      await criarConta()
      const primeiro = await pedirCodigo()
      const segundo = await pedirCodigo()

      if (primeiro !== segundo) expect((await verificar(primeiro)).status).toBe(400)
      expect((await verificar(segundo)).status).toBe(200)
    })

    it('o mais recente já usado não reativa um anterior ainda válido', async () => {
      const usuario = await criarConta()
      const primeiro = await pedirCodigo()
      await pedirCodigo()
      const [, maisRecente] = await codigosDoUsuario(usuario.id)
      await prismaTeste.codigoVerificacao.update({
        where: { id: maisRecente?.id },
        data: { usadoEm: new Date() },
      })

      expect((await verificar(primeiro)).status).toBe(400)
    })

    it('código de outro tipo (VERIFICAR_EMAIL) não vale', async () => {
      const usuario = await criarConta()
      await prismaTeste.codigoVerificacao.create({
        data: {
          usuarioId: usuario.id,
          tipo: 'VERIFICAR_EMAIL',
          codigoHash: hashDe(usuario.id, '048213'),
          expiraEm: new Date(Date.now() + VALIDADE_CODIGO_MS),
        },
      })

      expect((await verificar('048213')).body).toStrictEqual(CODIGO_INVALIDO)
    })

    it('e-mail inexistente → mesma resposta de código errado (critério 9)', async () => {
      expect((await verificar('048213', 'nao@ex.com')).body).toStrictEqual(CODIGO_INVALIDO)
    })

    it('código fora do formato → 400 VALIDATION_ERROR em codigo', async () => {
      const resposta = await verificar('48213')

      expect(resposta.status).toBe(400)
      expect(resposta.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [expect.objectContaining({ field: 'codigo' })],
      })
    })

    it('31ª verificação errada do mesmo IP na hora → 429', async () => {
      for (let i = 0; i < 30; i++) await verificar('048213', `nao${i}@ex.com`)

      const bloqueado = await verificar('048213')
      expect(bloqueado.status).toBe(429)
      expect(bloqueado.body).toMatchObject({ code: 'RATE_LIMITED' })
      expect((await verificar('048213', EMAIL, '10.0.0.2')).status).toBe(400)
    })
  })

  describe('POST /auth/senha/redefinir', () => {
    it('feliz → 204, troca a senha, consome o código, revoga as sessões e emite o evento após o commit (critérios 10 e 13)', async () => {
      const usuario = await criarConta()
      const aparelhoA = await abrirSessao(usuario.id)
      const aparelhoB = await abrirSessao(usuario.id)
      const codigo = await pedirCodigo()

      const resposta = await redefinir(codigo)

      expect(resposta.status).toBe(204)
      expect((await codigosDoUsuario(usuario.id))[0]?.usadoEm).not.toBeNull()
      const sessoes = await prismaTeste.sessao.findMany({ where: { usuarioId: usuario.id } })
      expect(sessoes).toHaveLength(2)
      for (const sessao of sessoes) {
        expect(sessao.revogadaEm).not.toBeNull()
        expect(sessao.motivoRevogacao).toBe('RECUPERACAO_SENHA')
      }

      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([
        {
          nome: 'usuario.sessaoEncerrada',
          payload: {
            usuarioId: usuario.id,
            sessaoIds: expect.arrayContaining([aparelhoA.sessaoId, aparelhoB.sessaoId]) as string[],
            motivo: 'RECUPERACAO_SENHA',
            autorId: null,
          },
        },
      ])

      const refresh = await request(contexto.http)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: aparelhoB.refreshToken })
      expect(refresh.status).toBe(401)
      expect(refresh.body).toMatchObject({ code: 'SESSAO_REVOGADA' })

      expect((await entrar(SENHA)).status).toBe(401)
      expect((await entrar(NOVA_SENHA)).status).toBe(200)
    })

    it('sem nenhuma sessão ativa → 204 e nenhum usuario.sessaoEncerrada', async () => {
      await criarConta()
      const codigo = await pedirCodigo()

      expect((await redefinir(codigo)).status).toBe(204)
      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([])
    })

    it('segunda redefinição com o mesmo código → 400 CODIGO_INVALIDO (critério 11)', async () => {
      await criarConta()
      const codigo = await pedirCodigo()

      expect((await redefinir(codigo)).status).toBe(204)
      expect((await redefinir(codigo, 'outraSenha1')).body).toStrictEqual(CODIGO_INVALIDO)
      expect((await entrar(NOVA_SENHA)).status).toBe(200)
    })

    it('duas redefinições simultâneas com o mesmo código → só uma 204', async () => {
      await criarConta()
      const codigo = await pedirCodigo()

      const respostas = await Promise.all([
        redefinir(codigo, 'primeira1'),
        redefinir(codigo, 'segunda2'),
      ])

      expect(respostas.map(({ status }) => status).sort()).toEqual([204, 400])
      expect(respostas.find(({ status }) => status === 400)?.body).toStrictEqual(CODIGO_INVALIDO)
    })

    it('senha fraca → 400 VALIDATION_ERROR em novaSenha, sem consumir nem contar tentativa (critério 12)', async () => {
      const usuario = await criarConta()
      const codigo = await pedirCodigo()

      const resposta = await redefinir(codigo, 'abcdefgh')

      expect(resposta.status).toBe(400)
      expect(resposta.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [expect.objectContaining({ field: 'novaSenha' })],
      })
      expect((await codigosDoUsuario(usuario.id))[0]).toMatchObject({
        usadoEm: null,
        tentativas: 0,
      })
    })

    it('código errado → 400 e conta tentativa, sem trocar a senha (critério 6)', async () => {
      const usuario = await criarConta()
      const codigo = await pedirCodigo()

      const resposta = await redefinir(codigo === '000000' ? '000001' : '000000')

      expect(resposta.body).toStrictEqual(CODIGO_INVALIDO)
      expect((await codigosDoUsuario(usuario.id))[0]?.tentativas).toBe(1)
      expect((await entrar(SENHA)).status).toBe(200)
    })

    it('login bloqueado por 5 falhas é liberado ao redefinir (critério 14)', async () => {
      await criarConta()
      for (let i = 0; i < 5; i++) await entrar('senha-errada1')
      expect((await entrar(SENHA)).status).toBe(429)
      const codigo = await pedirCodigo()

      expect((await redefinir(codigo)).status).toBe(204)
      expect((await entrar(NOVA_SENHA)).status).toBe(200)
    })

    it('limpa só as falhas de login do e-mail, mesmo com curinga de LIKE no endereço', async () => {
      await prismaTeste.tentativaAcesso.createMany({
        data: [
          { tipo: 'LOGIN_FALHA', chave: 'a_a@ex.com|10.0.0.1' },
          { tipo: 'LOGIN_FALHA', chave: 'aba@ex.com|10.0.0.1' },
          { tipo: 'CADASTRO', chave: 'a_a@ex.com|10.0.0.1' },
        ],
      })

      await contexto.app.get(RateLimitService).limparPorPrefixo('LOGIN_FALHA', 'a_a@ex.com|')

      const restantes = await prismaTeste.tentativaAcesso.findMany({ orderBy: { chave: 'asc' } })
      expect(restantes.map(({ tipo, chave }) => `${tipo} ${chave}`)).toEqual([
        'CADASTRO a_a@ex.com|10.0.0.1',
        'LOGIN_FALHA aba@ex.com|10.0.0.1',
      ])
    })

    it('falha na transação → rollback: código não consumido, senha e sessões intactas, nenhum evento', async () => {
      const usuario = await criarConta()
      await abrirSessao(usuario.id)
      const codigo = await pedirCodigo()
      const limpar = jest
        .spyOn(contexto.app.get(RateLimitService), 'limparPorPrefixo')
        .mockRejectedValueOnce(new Error('falha simulada'))
      const logErro = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

      try {
        expect((await redefinir(codigo)).status).toBe(500)
      } finally {
        limpar.mockRestore()
        logErro.mockRestore()
      }

      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([])
      expect((await codigosDoUsuario(usuario.id))[0]?.usadoEm).toBeNull()
      expect(await prismaTeste.sessao.count({ where: { revogadaEm: null } })).toBe(1)
      expect((await entrar(SENHA)).status).toBe(200)
    })
  })

  function hashDe(usuarioId: string, codigo: string): string {
    return contexto.app.get(CodigoVerificacaoService).hashCodigo(usuarioId, codigo)
  }
})
