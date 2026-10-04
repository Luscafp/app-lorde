import { executarSeed, LORDE, MODALIDADES_BASICAS } from '../../prisma/seed'
import { SENHA_DEMO } from '../../prisma/seed-demo'
import { ErroSeed } from '../../prisma/seed-env'
import { SenhaService } from '../../src/infra/senha/senha.service'
import { criarAtletica } from '../fabricas/atletica'
import { criarUsuario } from '../fabricas/usuario'
import { prismaTeste } from '../setup/prisma-teste'

const ENV_SEED = {
  DATABASE_URL: process.env.DATABASE_URL,
  SEED_ADMIN_EMAIL: ' Admin@Lorde.Local ',
  SEED_ADMIN_NOME: 'Administrador',
  SEED_ADMIN_SENHA: 'lorde2026',
}

const seed = (extra: Record<string, string | undefined> = {}) =>
  executarSeed({ ...ENV_SEED, ...extra })

async function contarTudo() {
  const [atleticas, usuarios, vinculos, modalidades, eventos, noticias] = await Promise.all([
    prismaTeste.atletica.count(),
    prismaTeste.usuario.count(),
    prismaTeste.vinculoAtletica.count(),
    prismaTeste.modalidade.count(),
    prismaTeste.evento.count(),
    prismaTeste.noticia.count(),
  ])
  return { atleticas, usuarios, vinculos, modalidades, eventos, noticias }
}

/** Épico #3 §11 "Seed" e critérios da #45. */
describe('Seed (#45)', () => {
  const senha = new SenhaService()

  it('cria Lorde, administrador e modalidades; a segunda execução não duplica (critério 2)', async () => {
    const primeiro = await seed()
    expect(primeiro).toMatchObject({
      adminCriado: true,
      modalidadesCriadas: MODALIDADES_BASICAS.length,
      demo: false,
    })
    const segundo = await seed()
    expect(segundo).toMatchObject({ adminCriado: false, modalidadesCriadas: 0 })
    expect(segundo.atleticaId).toBe(primeiro.atleticaId)

    expect(await prismaTeste.atletica.findMany()).toEqual([expect.objectContaining(LORDE)])
    expect(await prismaTeste.modalidade.count()).toBe(MODALIDADES_BASICAS.length)
    const admin = await prismaTeste.usuario.findUniqueOrThrow({
      where: { email: 'admin@lorde.local' },
      include: { vinculos: true, preferencia: true },
    })
    expect(await prismaTeste.usuario.count()).toBe(1)
    expect(admin).toMatchObject({ nome: 'Administrador', emailVerificado: true })
    expect(admin.vinculos).toEqual([
      expect.objectContaining({ atleticaId: primeiro.atleticaId, papel: 'ADMINISTRADOR' }),
    ])
    expect(admin.preferencia).toMatchObject({ pushAtivo: true, antecedenciaLembreteHoras: 2 })
    await expect(senha.verificar(admin.senhaHash, 'lorde2026')).resolves.toBe(true)
  })

  it('admin existente: outra SEED_ADMIN_SENHA não altera o hash', async () => {
    await seed()
    const antes = await prismaTeste.usuario.findUniqueOrThrow({
      where: { email: 'admin@lorde.local' },
    })
    await seed({ SEED_ADMIN_SENHA: 'outraSenha99', SEED_ADMIN_EMAIL: 'novo@lorde.local' })
    const depois = await prismaTeste.usuario.findUniqueOrThrow({ where: { id: antes.id } })
    expect(depois.senhaHash).toBe(antes.senhaHash)
    expect(await prismaTeste.usuario.count()).toBe(1)
  })

  it('mantém modalidade já existente com outro nome em maiúsculas', async () => {
    await prismaTeste.modalidade.create({ data: { nome: 'FUTSAL', icone: 'trophy' } })
    const resumo = await seed()
    expect(resumo.modalidadesCriadas).toBe(MODALIDADES_BASICAS.length - 1)
    expect(await prismaTeste.modalidade.findMany({ where: { icone: 'trophy' } })).toHaveLength(1)
  })

  it('SEED_ADMIN_SENHA fora da política → falha citando a política, sem gravar nada', async () => {
    const erro = await seed({ SEED_ADMIN_SENHA: 'abcdefgh' }).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ErroSeed)
    expect((erro as Error).message).toContain('SEED_ADMIN_SENHA')
    expect((erro as Error).message).toContain('política de senha')
    expect((erro as Error).message).not.toContain('abcdefgh')
    expect(await contarTudo()).toEqual({
      atleticas: 0,
      usuarios: 0,
      vinculos: 0,
      modalidades: 0,
      eventos: 0,
      noticias: 0,
    })
  })

  it('sem SEED_ADMIN_* → falha listando as variáveis, sem gravar nada', async () => {
    const erro = await executarSeed({ DATABASE_URL: process.env.DATABASE_URL, SEED_ADMIN_NOME: '' })
      .then(() => undefined)
      .catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ErroSeed)
    for (const variavel of ['SEED_ADMIN_EMAIL', 'SEED_ADMIN_NOME', 'SEED_ADMIN_SENHA']) {
      expect((erro as Error).message).toContain(`${variavel}: obrigatória`)
    }
    expect(await prismaTeste.atletica.count()).toBe(0)
  })

  it('SEED_DEMO=true com APP_ENV=producao → aborta antes de gravar', async () => {
    await expect(seed({ SEED_DEMO: 'true', APP_ENV: 'producao' })).rejects.toThrow(
      /SEED_DEMO: dados de demonstração nunca são gravados em produção/,
    )
    expect(await prismaTeste.atletica.count()).toBe(0)
  })

  it('NODE_ENV=production sem APP_ENV → aborta', async () => {
    await expect(seed({ NODE_ENV: 'production', SEED_DEMO: 'true' })).rejects.toThrow(/APP_ENV/)
    expect(await prismaTeste.atletica.count()).toBe(0)
  })

  it('outra atlética com usaAplicativo = true → falha com mensagem clara', async () => {
    await criarAtletica({ nome: 'Atlética Rival' })
    await expect(seed()).rejects.toThrow(/"Atlética Rival" também tem usaAplicativo = true/)
    expect(await prismaTeste.atletica.count()).toBe(1)
    expect(await prismaTeste.usuario.count()).toBe(0)
  })

  it('adversárias sem app não impedem o seed', async () => {
    await criarAtletica({ usaAplicativo: false })
    await expect(seed()).resolves.toMatchObject({ adminCriado: true })
  })

  it('SEED_ADMIN_EMAIL de um usuário sem vínculo ADMINISTRADOR → falha sem alterá-lo', async () => {
    const adversaria = await criarAtletica({ usaAplicativo: false })
    const usuario = await criarUsuario({ email: 'admin@lorde.local', atleticaId: adversaria.id })
    await expect(seed()).rejects.toThrow(/SEED_ADMIN_EMAIL já pertence a um usuário/)
    expect(
      await prismaTeste.usuario.findUniqueOrThrow({ where: { id: usuario.id } }),
    ).toMatchObject({ senhaHash: usuario.senhaHash, nome: usuario.nome })
    expect(await prismaTeste.vinculoAtletica.count({ where: { papel: 'ADMINISTRADOR' } })).toBe(0)
  })

  it('SEED_DEMO=true grava dados de demonstração uma única vez', async () => {
    const resumo = await seed({ SEED_DEMO: 'true', APP_ENV: 'homologacao' })
    expect(resumo.demo).toBe(true)
    const contagem = await contarTudo()
    expect(contagem).toEqual({
      atleticas: 2,
      usuarios: 6,
      vinculos: 6,
      modalidades: MODALIDADES_BASICAS.length,
      eventos: 3,
      noticias: 2,
    })
    expect(await prismaTeste.time.count()).toBe(2)

    await seed({ SEED_DEMO: 'true', APP_ENV: 'homologacao' })
    expect(await contarTudo()).toEqual(contagem)
    expect(await prismaTeste.time.count()).toBe(2)

    const diretor = await prismaTeste.usuario.findUniqueOrThrow({
      where: { email: 'diretor@demo.exemplo.com.br' },
    })
    await expect(senha.verificar(diretor.senhaHash, SENHA_DEMO)).resolves.toBe(true)
    const papeis = await prismaTeste.vinculoAtletica.findMany({
      where: { atleticaId: resumo.atleticaId },
      select: { papel: true },
    })
    expect(new Set(papeis.map(({ papel }) => papel))).toEqual(
      new Set(['ADMINISTRADOR', 'PRESIDENTE', 'VICE_PRESIDENTE', 'DIRETOR', 'ATLETA']),
    )
  })

  it('demo não recria Presidente quando o cargo já está ocupado (RN07)', async () => {
    const { atleticaId } = await seed()
    const presidente = await criarUsuario({ atleticaId, papel: 'PRESIDENTE' })
    await seed({ SEED_DEMO: 'true' })
    expect(await prismaTeste.vinculoAtletica.findMany({ where: { papel: 'PRESIDENTE' } })).toEqual([
      expect.objectContaining({ usuarioId: presidente.id }),
    ])
    expect(
      await prismaTeste.usuario.findUnique({ where: { email: 'presidente@demo.exemplo.com.br' } }),
    ).toBeNull()
  })
})
