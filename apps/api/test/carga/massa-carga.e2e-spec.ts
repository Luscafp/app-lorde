import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { executarLimpezaCarga } from '../../../../tests/carga/limpar-carga'
import {
  emailCarga,
  ErroCarga,
  FILTRO_EMAIL_CARGA,
  MENSAGEM_AMBIENTE_RECUSADO,
  PREFIXO_CARGA,
  SLUG_ADVERSARIA_CARGA,
  type EnvCarga,
} from '../../../../tests/carga/massa-carga'
import { executarSeedCarga } from '../../../../tests/carga/seed-carga'
import { executarSeed, LORDE, MODALIDADES_BASICAS } from '../../prisma/seed'
import { SenhaService } from '../../src/infra/senha/senha.service'
import { criarUsuario } from '../fabricas/usuario'
import { prismaTeste } from '../setup/prisma-teste'

const DATABASE_URL = process.env.DATABASE_URL as string
const ENV_CARGA: EnvCarga = { AMBIENTE: 'teste', DATABASE_URL, CARGA_SENHA: 'carga2026' }
const PASTA_CARGA = join(__dirname, '..', '..', '..', '..', 'tests', 'carga')

async function semearBase(): Promise<string> {
  const { atleticaId } = await executarSeed({
    DATABASE_URL,
    SEED_ADMIN_EMAIL: 'admin@lorde.local',
    SEED_ADMIN_NOME: 'Administrador',
    SEED_ADMIN_SENHA: 'lorde2026',
  })
  return atleticaId
}

async function contarTudo() {
  const [atleticas, usuarios, vinculos, times, membros, eventos, participacoes, noticias] =
    await Promise.all([
      prismaTeste.atletica.count(),
      prismaTeste.usuario.count(),
      prismaTeste.vinculoAtletica.count(),
      prismaTeste.time.count(),
      prismaTeste.membroTime.count(),
      prismaTeste.evento.count(),
      prismaTeste.participacao.count(),
      prismaTeste.noticia.count(),
    ])
  return { atleticas, usuarios, vinculos, times, membros, eventos, participacoes, noticias }
}

async function contarMassa() {
  const [usuarios, times, eventos, noticias, adversaria] = await Promise.all([
    prismaTeste.usuario.count({ where: { email: FILTRO_EMAIL_CARGA } }),
    prismaTeste.time.count({
      where: { nome: { startsWith: PREFIXO_CARGA }, atletica: { usaAplicativo: true } },
    }),
    prismaTeste.evento.count({ where: { local: { startsWith: PREFIXO_CARGA } } }),
    prismaTeste.noticia.count({ where: { titulo: { startsWith: PREFIXO_CARGA } } }),
    prismaTeste.atletica.count({ where: { slug: SLUG_ADVERSARIA_CARGA } }),
  ])
  return { usuarios, times, eventos, noticias, adversaria }
}

const URL_OUTRO_BANCO = DATABASE_URL.replace(/\/[^/?]+(\?|$)/, '/atletica_homolog$1')
const URL_MESMO_BANCO_OUTRA_SENHA = DATABASE_URL.replace(/:[^:@/]+@/, ':outra-senha@')

const AMBIENTES_RECUSADOS: [string, EnvCarga][] = [
  ['AMBIENTE=producao', { AMBIENTE: 'producao' }],
  ['AMBIENTE ausente', { AMBIENTE: undefined }],
  ['APP_ENV=producao', { AMBIENTE: 'homologacao', APP_ENV: 'producao' }],
  [
    'DATABASE_URL igual à DATABASE_URL_PRODUCAO',
    { AMBIENTE: 'homologacao', DATABASE_URL_PRODUCAO: URL_MESMO_BANCO_OUTRA_SENHA },
  ],
  ['AMBIENTE=teste fora de banco *_test', { DATABASE_URL: URL_OUTRO_BANCO }],
]

/** Épico #30 critério 8 e critérios da #83. */
describe('Massa de carga (#83)', () => {
  describe('trava de ambiente', () => {
    it.each(AMBIENTES_RECUSADOS)('seed recusa com %s, sem escrever nada', async (_, extra) => {
      await semearBase()
      const antes = await contarTudo()
      const erro = await executarSeedCarga({ ...ENV_CARGA, ...extra }).catch((e: unknown) => e)
      expect(erro).toBeInstanceOf(ErroCarga)
      expect((erro as Error).message).toBe(MENSAGEM_AMBIENTE_RECUSADO)
      expect(await contarTudo()).toEqual(antes)
    })

    it.each(AMBIENTES_RECUSADOS)('limpeza recusa com %s, sem remover nada', async (_, extra) => {
      await semearBase()
      await executarSeedCarga(ENV_CARGA)
      const antes = await contarTudo()
      await expect(executarLimpezaCarga({ ...ENV_CARGA, ...extra })).rejects.toThrow(
        MENSAGEM_AMBIENTE_RECUSADO,
      )
      expect(await contarTudo()).toEqual(antes)
    })

    it('scripts pela linha de comando saem com código 1 e a mensagem', async () => {
      const executar = promisify(execFile)
      const tsx = require.resolve('tsx/cli')
      for (const script of ['seed-carga.ts', 'limpar-carga.ts']) {
        const erro = (await executar(process.execPath, [tsx, join(PASTA_CARGA, script)], {
          env: { ...process.env, ...ENV_CARGA, AMBIENTE: 'producao' },
        }).catch((e: unknown) => e)) as { code?: number; stderr?: string }
        expect(erro.code).toBe(1)
        expect(erro.stderr).toContain(MENSAGEM_AMBIENTE_RECUSADO)
      }
      expect(await contarTudo()).toMatchObject({ atleticas: 0, usuarios: 0 })
    })
  })

  it('CARGA_SENHA fora da política → falha sem gravar', async () => {
    await semearBase()
    const antes = await contarTudo()
    await expect(executarSeedCarga({ ...ENV_CARGA, CARGA_SENHA: 'semnumero' })).rejects.toThrow(
      /CARGA_SENHA/,
    )
    expect(await contarTudo()).toEqual(antes)
  })

  it('sem o seed base → falha pedindo o seed', async () => {
    await expect(executarSeedCarga(ENV_CARGA)).rejects.toThrow(/rode antes o seed/)
    expect(await prismaTeste.usuario.count()).toBe(0)
  })

  it('cria a massa na atlética padrão; a segunda execução não duplica', async () => {
    const atleticaId = await semearBase()
    const resumo = await executarSeedCarga(ENV_CARGA)
    expect(resumo).toEqual({ usuarios: 200, times: 10, eventos: 300, noticias: 100 })
    const contagem = await contarTudo()

    await expect(executarSeedCarga(ENV_CARGA)).resolves.toEqual(resumo)
    expect(await contarTudo()).toEqual(contagem)
    expect(await contarMassa()).toEqual({
      usuarios: 200,
      times: 10,
      eventos: 300,
      noticias: 100,
      adversaria: 1,
    })

    const vinculos = await prismaTeste.vinculoAtletica.groupBy({
      by: ['atleticaId', 'papel'],
      where: { usuario: { email: FILTRO_EMAIL_CARGA } },
      _count: true,
    })
    expect(vinculos).toEqual([{ atleticaId, papel: 'ATLETA', _count: 200 }])

    const times = await prismaTeste.time.findMany({
      where: { atleticaId, nome: { startsWith: PREFIXO_CARGA } },
      include: { _count: { select: { membros: true, eventos: true } } },
    })
    expect(times.map(({ _count }) => _count)).toEqual(
      Array.from({ length: 10 }, () => ({ membros: 20, eventos: 30 })),
    )
    expect(await prismaTeste.evento.count({ where: { status: 'FINALIZADO' } })).toBe(100)
    expect(
      await prismaTeste.evento.count({ where: { status: 'AGENDADO', inicio: { gt: new Date() } } }),
    ).toBe(200)
    expect(await prismaTeste.noticia.count({ where: { atleticaId, status: 'PUBLICADA' } })).toBe(
      100,
    )

    const usuario = await prismaTeste.usuario.findUniqueOrThrow({
      where: { email: emailCarga(200) },
      include: { preferencia: true },
    })
    expect(usuario).toMatchObject({ emailVerificado: true, ativo: true })
    expect(usuario.preferencia).not.toBeNull()
    await expect(new SenhaService().verificar(usuario.senhaHash, 'carga2026')).resolves.toBe(true)
  })

  it('nova CARGA_SENHA é regravada nos usuários de carga', async () => {
    await semearBase()
    await executarSeedCarga(ENV_CARGA)
    await executarSeedCarga({ ...ENV_CARGA, CARGA_SENHA: 'outra2026' })
    const usuario = await prismaTeste.usuario.findUniqueOrThrow({
      where: { email: emailCarga(1) },
    })
    await expect(new SenhaService().verificar(usuario.senhaHash, 'outra2026')).resolves.toBe(true)
  })

  it('limpeza remove só a massa; usuário comum e seus dados permanecem', async () => {
    const atleticaId = await semearBase()
    const comum = await criarUsuario({ atleticaId, email: 'comum@teste.local' })
    const modalidade = await prismaTeste.modalidade.findFirstOrThrow()
    const time = await prismaTeste.time.create({
      data: { atleticaId, modalidadeId: modalidade.id, nome: 'Time comum' },
    })
    await prismaTeste.membroTime.create({
      data: { atleticaId, timeId: time.id, usuarioId: comum.id },
    })
    const evento = await prismaTeste.evento.create({
      data: {
        atleticaId,
        timeId: time.id,
        tipo: 'TREINO',
        inicio: new Date(Date.now() + 86_400_000),
        local: 'Ginásio',
        criadoPorId: comum.id,
      },
    })
    await prismaTeste.participacao.create({
      data: {
        atleticaId,
        eventoId: evento.id,
        usuarioId: comum.id,
        confirmado: true,
        respondidoEm: new Date(),
      },
    })
    await prismaTeste.noticia.create({
      data: { atleticaId, autorId: comum.id, titulo: 'Notícia comum', status: 'RASCUNHO' },
    })
    const antes = await contarTudo()

    await executarSeedCarga(ENV_CARGA)
    const participante = await prismaTeste.usuario.findUniqueOrThrow({
      where: { email: emailCarga(1) },
      include: { membrosTime: true },
    })
    const eventoDaMassa = await prismaTeste.evento.findFirstOrThrow({
      where: { timeId: participante.membrosTime[0]?.timeId, status: 'AGENDADO' },
    })
    await prismaTeste.participacao.create({
      data: {
        atleticaId,
        eventoId: eventoDaMassa.id,
        usuarioId: participante.id,
        confirmado: false,
        respondidoEm: new Date(),
      },
    })
    await prismaTeste.sessao.create({
      data: {
        usuarioId: participante.id,
        atleticaId,
        refreshTokenHash: 'a'.repeat(64),
        expiraEm: new Date(Date.now() + 86_400_000),
      },
    })

    await expect(executarLimpezaCarga(ENV_CARGA)).resolves.toEqual({
      usuarios: 200,
      times: 10 + MODALIDADES_BASICAS.length,
      eventos: 300,
      noticias: 100,
    })
    expect(await contarMassa()).toEqual({
      usuarios: 0,
      times: 0,
      eventos: 0,
      noticias: 0,
      adversaria: 0,
    })
    expect(await contarTudo()).toEqual(antes)
    expect(await prismaTeste.sessao.count()).toBe(0)
    expect(await prismaTeste.atletica.findUnique({ where: { slug: LORDE.slug } })).not.toBeNull()
    expect(
      await prismaTeste.usuario.findUnique({ where: { email: 'admin@lorde.local' } }),
    ).not.toBeNull()

    await expect(executarLimpezaCarga(ENV_CARGA)).resolves.toEqual({
      usuarios: 0,
      times: 0,
      eventos: 0,
      noticias: 0,
    })
  })
})
