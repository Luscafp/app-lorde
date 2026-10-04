import { performance } from 'node:perf_hooks'
import { respostaSessaoSchema } from '@atletica/shared'
import { hash } from '@node-rs/argon2'
import request from 'supertest'
import { SenhaService } from '../../src/infra/senha/senha.service'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { criarAtletica } from '../fabricas/atletica'
import { criarUsuario, type DadosUsuario } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/auth/login'
const SENHA = 'lorde2026'
const IP_A = '10.0.0.1'
const IP_B = '10.0.0.2'

const CREDENCIAIS_INVALIDAS = {
  statusCode: 401,
  code: 'CREDENCIAIS_INVALIDAS',
  message: 'E-mail ou senha incorretos.',
  details: [],
}

describe('POST /auth/login (#57)', () => {
  let contexto: AppDeTeste
  let padraoId: string
  let senhaHash: string

  const entrar = (email: string, senha: string, ip = IP_A) =>
    request(contexto.http).post(ROTA).set('X-Forwarded-For', ip).send({ email, senha })

  const criarConta = (dados: DadosUsuario = {}) =>
    criarUsuario({ email: 'ana@ex.com', senhaHash, atleticaId: padraoId, ...dados })

  async function falhar(vezes: number, email = 'ana@ex.com', ip = IP_A) {
    for (let i = 0; i < vezes; i++) await entrar(email, 'senha-errada1', ip)
  }

  beforeAll(async () => {
    contexto = await criarApp()
    padraoId = contexto.app.get(AtleticaPadraoService).id()
    senhaHash = await contexto.app.get(SenhaService).hash(SENHA)
  })

  beforeEach(async () => {
    await criarAtletica({ id: padraoId, nome: 'Atlética Lorde' })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  it('feliz: e-mail com espaços e outra caixa → 200 com o contrato da sessão (critério 6)', async () => {
    const usuario = await criarConta({ nome: 'Ana', papel: 'DIRETOR' })

    const resposta = await entrar('  ANA@Ex.com ', SENHA)

    expect(resposta.status).toBe(200)
    const corpo = respostaSessaoSchema.parse(resposta.body)
    expect(corpo.usuario).toStrictEqual({
      id: usuario.id,
      nome: 'Ana',
      email: 'ana@ex.com',
      fotoUrl: null,
      papel: 'DIRETOR',
      atleticaId: padraoId,
    })
    const [sessaoId] = corpo.refreshToken.split('.')
    await expect(prismaTeste.sessao.findUnique({ where: { id: sessaoId } })).resolves.toMatchObject(
      {
        usuarioId: usuario.id,
        atleticaId: padraoId,
        ip: IP_A,
      },
    )
  })

  it('login correto apaga as falhas anteriores da chave', async () => {
    await criarConta()
    await falhar(3)

    expect((await entrar('ana@ex.com', SENHA)).status).toBe(200)
    await expect(prismaTeste.tentativaAcesso.count()).resolves.toBe(0)
  })

  describe('credenciais inválidas (critério 7)', () => {
    it('e-mail inexistente e senha errada → mesma resposta 401', async () => {
      await criarConta()

      const inexistente = await entrar('bia@ex.com', SENHA)
      const senhaErrada = await entrar('ana@ex.com', 'outra-senha1')

      expect(inexistente.status).toBe(401)
      expect(inexistente.body).toEqual(CREDENCIAIS_INVALIDAS)
      expect(senhaErrada.body).toEqual(CREDENCIAIS_INVALIDAS)
    })

    it('tempo de resposta equivalente (diferença média < 50 ms)', async () => {
      await criarConta()
      const medir = async (email: string, ip: string) => {
        const inicio = performance.now()
        await entrar(email, 'outra-senha1', ip)
        return performance.now() - inicio
      }

      await medir('aquecimento@ex.com', '10.1.0.0')
      const inexistente: number[] = []
      const senhaErrada: number[] = []
      for (let i = 1; i <= 4; i++) {
        inexistente.push(await medir(`ninguem${i}@ex.com`, `10.1.0.${i}`))
        senhaErrada.push(await medir('ana@ex.com', `10.2.0.${i}`))
      }

      const media = (valores: number[]) => valores.reduce((a, b) => a + b, 0) / valores.length
      expect(Math.abs(media(inexistente) - media(senhaErrada))).toBeLessThan(50)
    })

    it('conta excluída é tratada como inexistente', async () => {
      await criarConta()
      await prismaTeste.usuario.updateMany({ data: { excluidoEm: new Date() } })

      expect((await entrar('ana@ex.com', SENHA)).body).toEqual(CREDENCIAIS_INVALIDAS)
    })

    it('usuário sem vínculo com a atlética padrão é tratado como inexistente', async () => {
      const outra = await criarAtletica({ usaAplicativo: false })
      await criarConta({ atleticaId: outra.id })

      expect((await entrar('ana@ex.com', SENHA)).body).toEqual(CREDENCIAIS_INVALIDAS)
    })
  })

  describe('limite de 5 falhas em 15 min por e-mail + IP', () => {
    it('4ª falha avisa que é a última tentativa (critério 8)', async () => {
      await criarConta()
      await falhar(3)

      const resposta = await entrar('ana@ex.com', 'senha-errada1')

      expect(resposta.status).toBe(401)
      expect(resposta.body).toMatchObject({
        code: 'CREDENCIAIS_INVALIDAS',
        message: 'E-mail ou senha incorretos. Última tentativa antes do bloqueio.',
      })
    })

    it('5ª falha → 429 com Retry-After: 900 (critério 9)', async () => {
      await criarConta()
      await falhar(4)

      const resposta = await entrar('ana@ex.com', 'senha-errada1')

      expect(resposta.status).toBe(429)
      expect(resposta.body).toMatchObject({ code: 'RATE_LIMITED' })
      expect(resposta.headers['retry-after']).toBe('900')
    })

    it('senha correta durante o bloqueio → 429, sem registrar nova falha', async () => {
      await criarConta()
      await falhar(5)

      const resposta = await entrar('ana@ex.com', SENHA)

      expect(resposta.status).toBe(429)
      expect(Number(resposta.headers['retry-after'])).toBeGreaterThan(0)
      expect(Number(resposta.headers['retry-after'])).toBeLessThanOrEqual(900)
      await expect(prismaTeste.tentativaAcesso.count()).resolves.toBe(5)
    })

    it('outro e-mail no mesmo IP e o mesmo e-mail em outro IP seguem liberados (critério 10)', async () => {
      await criarConta()
      await criarConta({ email: 'bia@ex.com' })
      await falhar(5)

      expect((await entrar('bia@ex.com', SENHA, IP_A)).status).toBe(200)
      expect((await entrar('ana@ex.com', SENHA, IP_B)).status).toBe(200)
    })
  })

  describe('conta desativada (critério 11)', () => {
    const DESATIVADA = {
      statusCode: 401,
      code: 'CONTA_DESATIVADA',
      message: 'Sua conta está desativada. Procure a diretoria da Atlética Lorde.',
      details: [],
    }

    it('vínculo desativado com senha certa → 401 CONTA_DESATIVADA', async () => {
      await criarConta({ vinculoAtivo: false })
      expect((await entrar('ana@ex.com', SENHA)).body).toEqual(DESATIVADA)
    })

    it('conta desativada com senha certa → 401 CONTA_DESATIVADA', async () => {
      await criarConta({ ativo: false })
      expect((await entrar('ana@ex.com', SENHA)).body).toEqual(DESATIVADA)
    })

    it('desativada com senha errada → 401 CREDENCIAIS_INVALIDAS', async () => {
      await criarConta({ vinculoAtivo: false })
      expect((await entrar('ana@ex.com', 'senha-errada1')).body).toEqual(CREDENCIAIS_INVALIDAS)
    })

    it('não cria sessão', async () => {
      await criarConta({ vinculoAtivo: false })
      await entrar('ana@ex.com', SENHA)
      await expect(prismaTeste.sessao.count()).resolves.toBe(0)
    })
  })

  it('hash com parâmetros antigos é refeito no login', async () => {
    const antigo = await hash(SENHA, { algorithm: 2, memoryCost: 4096, timeCost: 1 })
    const usuario = await criarConta({ senhaHash: antigo })

    expect((await entrar('ana@ex.com', SENHA)).status).toBe(200)

    const { senhaHash: novo } = await prismaTeste.usuario.findUniqueOrThrow({
      where: { id: usuario.id },
    })
    expect(novo).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    expect((await entrar('ana@ex.com', SENHA)).status).toBe(200)
  })

  it('campo desconhecido → 400', async () => {
    const resposta = await request(contexto.http)
      .post(ROTA)
      .send({ email: 'ana@ex.com', senha: SENHA, lembrar: true })
    expect(resposta.status).toBe(400)
    expect(resposta.body).toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})
