import request from 'supertest'
import { criarAtletica } from '../fabricas/atletica'
import { criarUsuario, SENHA_HASH_FICTICIO } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { limparBanco } from '../setup/limpar-banco'
import { prismaTeste } from '../setup/prisma-teste'

describe('limparBanco (#42)', () => {
  it('esvazia tabelas relacionadas e preserva _prisma_migrations', async () => {
    await criarUsuario({ papel: 'DIRETOR' })
    expect(await prismaTeste.usuario.count()).toBe(1)
    expect(await prismaTeste.vinculoAtletica.count()).toBe(1)

    await limparBanco()

    expect(await prismaTeste.usuario.count()).toBe(0)
    expect(await prismaTeste.vinculoAtletica.count()).toBe(0)
    expect(await prismaTeste.atletica.count()).toBe(0)
    const [migrations] = await prismaTeste.$queryRaw<[{ total: bigint }]>`
      SELECT count(*) AS total FROM _prisma_migrations`
    expect(migrations.total).toBeGreaterThan(0n)
  })

  // Os dois testes abaixo rodam em sequência: o segundo prova que o beforeEach global limpou
  // o que o primeiro gravou (épico #2, critério 5).
  it('grava dados sem limpar ao final', async () => {
    await criarUsuario()
    expect(await prismaTeste.usuario.count()).toBe(1)
  })

  it('o teste seguinte começa com o banco vazio', async () => {
    expect(await prismaTeste.usuario.count()).toBe(0)
    expect(await prismaTeste.atletica.count()).toBe(0)
  })
})

describe('criarAtletica (#42)', () => {
  it('por padrão usa o aplicativo, com slug, sigla e cores válidas', async () => {
    const atletica = await criarAtletica()
    expect(atletica).toMatchObject({
      usaAplicativo: true,
      slug: expect.stringMatching(/^atletica-\d+$/) as string,
      sigla: expect.any(String) as string,
      corPrimaria: expect.stringMatching(/^#[0-9A-F]{6}$/i) as string,
      corSecundaria: expect.stringMatching(/^#[0-9A-F]{6}$/i) as string,
    })
  })

  it('adversária: usaAplicativo = false, sem dados de app', async () => {
    const adversaria = await criarAtletica({ usaAplicativo: false })
    expect(adversaria).toMatchObject({
      usaAplicativo: false,
      slug: null,
      sigla: null,
      corPrimaria: null,
    })
  })

  it('aceita sobrescritas e gera valores únicos', async () => {
    const lorde = await criarAtletica({ nome: 'Atlética Lorde', slug: 'lorde', sigla: 'AAL' })
    expect(lorde).toMatchObject({ nome: 'Atlética Lorde', slug: 'lorde', sigla: 'AAL' })
    const [a, b] = [await criarAtletica(), await criarAtletica()]
    expect(a.slug).not.toBe(b.slug)
  })
})

describe('criarUsuario (#42)', () => {
  it('criarUsuario({ papel: DIRETOR }) cria Usuario, Atletica com app e VinculoAtletica DIRETOR', async () => {
    const usuario = await criarUsuario({ papel: 'DIRETOR' })

    const noBanco = await prismaTeste.usuario.findUniqueOrThrow({
      where: { id: usuario.id },
      include: { vinculos: { include: { atletica: true } } },
    })
    expect(noBanco.vinculos).toHaveLength(1)
    expect(noBanco.vinculos[0]).toMatchObject({
      papel: 'DIRETOR',
      ativo: true,
      atleticaId: usuario.atleticaId,
      atletica: { usaAplicativo: true },
    })
    expect(usuario.vinculo).toMatchObject({ papel: 'DIRETOR', atleticaId: usuario.atleticaId })
  })

  it('valores padrão: ATLETA, conta e vínculo ativos, hash fictício', async () => {
    const usuario = await criarUsuario()
    expect(usuario).toMatchObject({
      ativo: true,
      senhaHash: SENHA_HASH_FICTICIO,
      vinculo: { papel: 'ATLETA', ativo: true },
    })
  })

  it('usa a atlética informada e as sobrescritas; e-mail gravado em minúsculas', async () => {
    const atletica = await criarAtletica()
    const usuario = await criarUsuario({
      papel: 'PRESIDENTE',
      atleticaId: atletica.id,
      nome: 'Ana',
      email: 'Ana@Ex.com',
      ativo: false,
      vinculoAtivo: false,
      senhaHash: 'hash-real',
    })
    expect(usuario).toMatchObject({
      nome: 'Ana',
      email: 'ana@ex.com',
      ativo: false,
      senhaHash: 'hash-real',
      atleticaId: atletica.id,
      vinculo: { papel: 'PRESIDENTE', ativo: false, atleticaId: atletica.id },
    })
    expect(await prismaTeste.atletica.count()).toBe(1)
  })

  it('e-mails únicos em chamadas repetidas', async () => {
    const usuarios = [await criarUsuario(), await criarUsuario(), await criarUsuario()]
    const emails = usuarios.map(({ email }) => email)
    expect(new Set(emails).size).toBe(3)
    for (const email of emails) expect(email).toBe(email.toLowerCase())
  })
})

describe('criarApp (#42)', () => {
  let contexto: AppDeTeste

  beforeAll(async () => {
    contexto = await criarApp()
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  it('rota inexistente → 404 NOT_FOUND no formato da convenção §4.1', async () => {
    const resposta = await request(contexto.http).get('/api/v1/nao-existe')
    expect(resposta.status).toBe(404)
    expect(resposta.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: expect.any(String) as string,
      details: [],
    })
  })
})
