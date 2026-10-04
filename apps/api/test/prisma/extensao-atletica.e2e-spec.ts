import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { mapearExcecao } from '../../src/common/filtros/excecao-global.filter'
import { ConfiguracaoModule } from '../../src/config/config.module'
import { ContextoAtletica } from '../../src/infra/contexto/contexto-atletica.service'
import { ContextoModule } from '../../src/infra/contexto/contexto.module'
import { ErroAtleticaContextoAusente, ErroAtleticaDivergente } from '../../src/infra/contexto/erros'
import { PrismaModule } from '../../src/infra/prisma/prisma.module'
import { PrismaService } from '../../src/infra/prisma/prisma.service'
import type { Prisma } from '../../src/generated/prisma/client'
import { criarAtletica } from '../fabricas/atletica'
import { proximaSequencia } from '../fabricas/sequencia'
import { criarUsuario } from '../fabricas/usuario'
import { criarApp } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'
import { EscopoController } from '../suporte/escopo.controller'

/** Critérios 3 a 8 do épico #3, com dados preparados pelo `prismaTeste` (sem filtro). */

// TODO: trocar pelas fábricas de domínio quando existirem (times → #63, eventos → #70).
function criarModalidade() {
  return prismaTeste.modalidade.create({
    data: { nome: `Modalidade ${proximaSequencia()}`, icone: 'bola' },
  })
}

function criarTime(atleticaId: string, modalidadeId: string) {
  return prismaTeste.time.create({
    data: { atleticaId, modalidadeId, nome: `Time ${proximaSequencia()}` },
  })
}

/** Atlética com um time, um diretor e um treino. */
async function montarAtletica(modalidadeId: string) {
  const atletica = await criarAtletica()
  const time = await criarTime(atletica.id, modalidadeId)
  const diretor = await criarUsuario({ atleticaId: atletica.id, papel: 'DIRETOR' })
  const evento = await prismaTeste.evento.create({
    data: { ...dadosTreino(time.id, diretor.id), atleticaId: atletica.id },
  })
  return { atletica, time, diretor, evento }
}

/** Cast para testar o preenchimento: os tipos gerados exigem `atleticaId`. */
function semAtleticaId<T extends object>(dados: T): T & { atleticaId: string } {
  return dados as T & { atleticaId: string }
}

function dadosTreino(timeId: string, criadoPorId: string) {
  return {
    tipo: 'TREINO' as const,
    timeId,
    inicio: new Date('2026-11-10T19:00:00Z'),
    local: 'Ginásio',
    criadoPorId,
  }
}

async function montarCenario() {
  const modalidade = await criarModalidade()
  const a = await montarAtletica(modalidade.id)
  const b = await montarAtletica(modalidade.id)
  const adversaria = await criarAtletica({ usaAplicativo: false })
  const timeAdversario = await criarTime(adversaria.id, modalidade.id)
  return { modalidade, a, b, adversaria, timeAdversario }
}
type Cenario = Awaited<ReturnType<typeof montarCenario>>

/** Espera "não encontrado" (`P2025`), mapeado pelo filtro global para 404 `NOT_FOUND`. */
async function esperarNaoEncontrado(operacao: Promise<unknown>): Promise<void> {
  const erro: unknown = await operacao.then(
    () => {
      throw new Error('esperava P2025, mas a operação foi aceita')
    },
    (e: unknown) => e,
  )
  expect(erro).toMatchObject({ code: 'P2025' })
  expect(mapearExcecao(erro)).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' })
}

describe('Extensão multi-atlética (#44)', () => {
  let modulo: TestingModule
  let prisma: PrismaService
  let contexto: ContextoAtletica
  let c: Cenario

  /** Executa `fn` com a atlética A no contexto. */
  const emA = <T>(fn: () => Promise<T>): Promise<T> =>
    contexto.executarComAtletica(c.a.atletica.id, fn)

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfiguracaoModule, ContextoModule, PrismaModule],
    }).compile()
    await modulo.init()
    prisma = modulo.get(PrismaService)
    contexto = modulo.get(ContextoAtletica)
  })

  afterAll(async () => {
    await modulo.close()
  })

  beforeEach(async () => {
    c = await montarCenario()
  })

  describe('leitura', () => {
    it('findMany só devolve registros da atlética do contexto (critério 3)', async () => {
      const eventos = await emA(() => prisma.db.evento.findMany())
      expect(eventos.map(({ id }) => id)).toEqual([c.a.evento.id])
    })

    it('findMany preserva o where original', async () => {
      const where = { OR: [{ id: c.a.evento.id }, { id: c.b.evento.id }] }
      expect(await emA(() => prisma.db.evento.findMany({ where }))).toHaveLength(1)
      expect(await emA(() => prisma.db.evento.findMany({ where: { local: 'Outro' } }))).toEqual([])
    })

    it('findFirst / findFirstOrThrow não encontram registro de outra atlética', async () => {
      const where = { id: c.b.evento.id }
      expect(await emA(() => prisma.db.evento.findFirst({ where }))).toBeNull()
      await esperarNaoEncontrado(emA(() => prisma.db.evento.findFirstOrThrow({ where })))
      expect(await emA(() => prisma.db.evento.findFirst())).toMatchObject({ id: c.a.evento.id })
    })

    it('findUnique de outra atlética → null; findUniqueOrThrow → P2025 (critério 4)', async () => {
      const where = { id: c.b.evento.id }
      expect(await emA(() => prisma.db.evento.findUnique({ where }))).toBeNull()
      await esperarNaoEncontrado(emA(() => prisma.db.evento.findUniqueOrThrow({ where })))
      const proprio = await emA(() => prisma.db.evento.findUnique({ where: { id: c.a.evento.id } }))
      expect(proprio).toMatchObject({ id: c.a.evento.id })
    })

    it('findUnique por chave composta com a atlética de outra → null', async () => {
      const tag = await prismaTeste.tag.create({
        data: { atleticaId: c.b.atletica.id, nome: 'Copa', nomeNormalizado: 'copa' },
      })
      const where = {
        atleticaId_nomeNormalizado: { atleticaId: c.b.atletica.id, nomeNormalizado: 'copa' },
      }
      expect(await emA(() => prisma.db.tag.findUnique({ where }))).toBeNull()
      expect(await prismaTeste.tag.findUnique({ where })).toMatchObject({ id: tag.id })
    })

    it('count, aggregate e groupBy só consideram a atlética do contexto', async () => {
      expect(await emA(() => prisma.db.evento.count())).toBe(1)
      const agregado = await emA(() => prisma.db.evento.aggregate({ _count: { _all: true } }))
      expect(agregado._count._all).toBe(1)
      const grupos = await emA(() =>
        prisma.db.evento.groupBy({ by: ['atleticaId'], _count: { _all: true } }),
      )
      expect(grupos).toEqual([{ atleticaId: c.a.atletica.id, _count: { _all: 1 } }])
    })

    it('modelos sem escopo não são filtrados', async () => {
      expect(await emA(() => prisma.db.usuario.count())).toBe(2)
      expect(await emA(() => prisma.db.atletica.count())).toBe(3)
    })
  })

  describe('escrita por where', () => {
    it('update de outra atlética → P2025 → 404 e o registro fica intacto (critério 4)', async () => {
      await esperarNaoEncontrado(
        emA(() => prisma.db.evento.update({ where: { id: c.b.evento.id }, data: { local: 'X' } })),
      )
      expect(await prismaTeste.evento.findUnique({ where: { id: c.b.evento.id } })).toMatchObject({
        local: 'Ginásio',
      })
      const proprio = await emA(() =>
        prisma.db.evento.update({ where: { id: c.a.evento.id }, data: { local: 'X' } }),
      )
      expect(proprio.local).toBe('X')
    })

    it('update tentando mover o registro para outra atlética → ErroAtleticaDivergente', async () => {
      await expect(
        emA(() =>
          prisma.db.evento.update({
            where: { id: c.a.evento.id },
            data: { atleticaId: c.b.atletica.id },
          }),
        ),
      ).rejects.toBeInstanceOf(ErroAtleticaDivergente)
    })

    it('updateMany e updateManyAndReturn só alteram a atlética do contexto', async () => {
      expect(await emA(() => prisma.db.evento.updateMany({ data: { local: 'X' } }))).toEqual({
        count: 1,
      })
      const alterados = await emA(() =>
        prisma.db.evento.updateManyAndReturn({ data: { local: 'Y' } }),
      )
      expect(alterados.map(({ id }) => id)).toEqual([c.a.evento.id])
      expect(await prismaTeste.evento.findUnique({ where: { id: c.b.evento.id } })).toMatchObject({
        local: 'Ginásio',
      })
    })

    it('delete de outra atlética → P2025; da própria, apaga', async () => {
      await esperarNaoEncontrado(
        emA(() => prisma.db.evento.delete({ where: { id: c.b.evento.id } })),
      )
      await emA(() => prisma.db.evento.delete({ where: { id: c.a.evento.id } }))
      expect(await prismaTeste.evento.findMany({ select: { id: true } })).toEqual([
        { id: c.b.evento.id },
      ])
    })

    it('deleteMany só apaga a atlética do contexto', async () => {
      expect(await emA(() => prisma.db.evento.deleteMany())).toEqual({ count: 1 })
      expect(await prismaTeste.evento.count()).toBe(1)
    })

    it('upsert não altera registro de outra atlética: cria um novo na do contexto', async () => {
      const tagB = await prismaTeste.tag.create({
        data: { atleticaId: c.b.atletica.id, nome: 'Copa', nomeNormalizado: 'copa' },
      })
      const resultado = await emA(() =>
        prisma.db.tag.upsert({
          where: { id: tagB.id },
          create: semAtleticaId({ nome: 'Copa', nomeNormalizado: 'copa' }),
          update: { nome: 'Alterada' },
        }),
      )
      expect(resultado).toMatchObject({ atleticaId: c.a.atletica.id, nome: 'Copa' })
      expect(resultado.id).not.toBe(tagB.id)
      expect(await prismaTeste.tag.findUnique({ where: { id: tagB.id } })).toMatchObject({
        nome: 'Copa',
      })

      const atualizada = await emA(() =>
        prisma.db.tag.upsert({
          where: { id: resultado.id },
          create: semAtleticaId({ nome: 'Nunca', nomeNormalizado: 'nunca' }),
          update: { nome: 'Alterada' },
        }),
      )
      expect(atualizada).toMatchObject({ id: resultado.id, nome: 'Alterada' })
    })
  })

  describe('criação', () => {
    it('create sem atleticaId grava a atlética do contexto (critério 5)', async () => {
      const evento = await emA(() =>
        prisma.db.evento.create({ data: semAtleticaId(dadosTreino(c.a.time.id, c.a.diretor.id)) }),
      )
      expect(evento.atleticaId).toBe(c.a.atletica.id)
    })

    it('create com atleticaId de outra atlética → ErroAtleticaDivergente (critério 5)', async () => {
      await expect(
        emA(() =>
          prisma.db.evento.create({
            data: { ...dadosTreino(c.b.time.id, c.b.diretor.id), atleticaId: c.b.atletica.id },
          }),
        ),
      ).rejects.toBeInstanceOf(ErroAtleticaDivergente)
      expect(await prismaTeste.evento.count()).toBe(2)
    })

    it('createMany e createManyAndReturn preenchem a atlética do contexto', async () => {
      expect(
        await emA(() =>
          prisma.db.tag.createMany({
            data: [
              semAtleticaId({ nome: 'A', nomeNormalizado: 'a' }),
              semAtleticaId({ nome: 'B', nomeNormalizado: 'b' }),
            ],
          }),
        ),
      ).toEqual({ count: 2 })
      const criadas = await emA(() =>
        prisma.db.tag.createManyAndReturn({
          data: [semAtleticaId({ nome: 'C', nomeNormalizado: 'c' })],
        }),
      )
      expect(criadas).toEqual([expect.objectContaining({ atleticaId: c.a.atletica.id })])
      expect(await prismaTeste.tag.count({ where: { atleticaId: c.a.atletica.id } })).toBe(3)
    })

    it('create na forma com relações preenche a atlética com connect', async () => {
      const data = {
        evento: { connect: { id: c.a.evento.id } },
        usuario: { connect: { id: c.a.diretor.id } },
      } as Prisma.ParticipacaoCreateInput
      const participacao = await emA(() => prisma.db.participacao.create({ data }))
      expect(participacao.atleticaId).toBe(c.a.atletica.id)
    })

    it('connect de atletica por slug de outra atlética → P2025', async () => {
      const slug = c.b.atletica.slug ?? ''
      const erro: unknown = await emA(() =>
        prisma.db.tag.create({
          data: { nome: 'X', nomeNormalizado: 'x', atletica: { connect: { slug } } },
        }),
      ).catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'P2025' })
      expect(await prismaTeste.tag.count()).toBe(0)
    })
  })

  describe('sem contexto (critério 6)', () => {
    it('modelo com escopo → ErroAtleticaContextoAusente, sem ir ao banco', async () => {
      await expect(prisma.db.evento.findMany()).rejects.toBeInstanceOf(ErroAtleticaContextoAusente)
      await expect(
        prisma.db.evento.create({ data: semAtleticaId(dadosTreino(c.a.time.id, c.a.diretor.id)) }),
      ).rejects.toBeInstanceOf(ErroAtleticaContextoAusente)
      expect(await prismaTeste.evento.count()).toBe(2)
    })

    it('modelo sem escopo funciona', async () => {
      expect(await prisma.db.usuario.findMany()).toHaveLength(2)
    })

    it('semEscopo enxerga todas as atléticas', async () => {
      // eslint-disable-next-line no-restricted-syntax -- teste do próprio PrismaService
      expect(await prisma.semEscopo.evento.count()).toBe(2)
    })
  })

  describe('Time (regra especial, critério 7)', () => {
    it('lista os times próprios e os de adversárias sem app, nunca os de outra com app', async () => {
      const times = await emA(() => prisma.db.time.findMany({ orderBy: { nome: 'asc' } }))
      expect(times.map(({ id }) => id).sort()).toEqual([c.a.time.id, c.timeAdversario.id].sort())
      expect(await emA(() => prisma.db.time.findUnique({ where: { id: c.b.time.id } }))).toBeNull()
    })

    it('a regra se soma ao where original', async () => {
      const where = { OR: [{ id: c.b.time.id }, { id: c.timeAdversario.id }] }
      const times = await emA(() => prisma.db.time.findMany({ where }))
      expect(times.map(({ id }) => id)).toEqual([c.timeAdversario.id])
    })

    it('update/delete em time de outra atlética com app → P2025 → 404', async () => {
      await esperarNaoEncontrado(
        emA(() => prisma.db.time.update({ where: { id: c.b.time.id }, data: { nome: 'X' } })),
      )
      await esperarNaoEncontrado(emA(() => prisma.db.time.delete({ where: { id: c.b.time.id } })))
      expect(await emA(() => prisma.db.time.updateMany({ data: { ativo: false } }))).toEqual({
        count: 2,
      })
      expect(await prismaTeste.time.findUnique({ where: { id: c.b.time.id } })).toMatchObject({
        ativo: true,
      })
    })

    it('create não preenche nem rejeita atleticaId (validação no service da #16)', async () => {
      const time = await emA(() =>
        prisma.db.time.create({
          data: {
            atleticaId: c.adversaria.id,
            modalidadeId: c.modalidade.id,
            nome: 'Adversário 2',
          },
        }),
      )
      expect(time.atleticaId).toBe(c.adversaria.id)
    })
  })

  describe('transações (critério 8)', () => {
    it('transação interativa aplica o filtro e preenche a atlética', async () => {
      const resultado = await emA(() =>
        prisma.db.$transaction(async (tx) => {
          const eventos = await tx.evento.findMany()
          const criado = await tx.evento.create({
            data: semAtleticaId(dadosTreino(c.a.time.id, c.a.diretor.id)),
          })
          const deOutra = await tx.evento.findUnique({ where: { id: c.b.evento.id } })
          return { eventos, criado, deOutra }
        }),
      )
      expect(resultado.eventos.map(({ id }) => id)).toEqual([c.a.evento.id])
      expect(resultado.criado.atleticaId).toBe(c.a.atletica.id)
      expect(resultado.deOutra).toBeNull()
    })

    it('transação em lote também é filtrada', async () => {
      const [eventos, total] = await emA(() =>
        prisma.db.$transaction([prisma.db.evento.findMany(), prisma.db.evento.count()]),
      )
      expect(eventos).toHaveLength(1)
      expect(total).toBe(1)
    })
  })
})

describe('Rota sem atlética no contexto (#44)', () => {
  it('ErroAtleticaContextoAusente → 500 INTERNAL_ERROR com a mensagem genérica', async () => {
    const { app, http } = await criarApp({ controllers: [EscopoController] })
    try {
      const resposta = await request(http).get('/api/v1/escopo/eventos')
      expect(resposta.status).toBe(500)
      expect(resposta.body).toEqual({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Ocorreu um erro inesperado. Tente novamente.',
        details: [],
      })
    } finally {
      await app.close()
    }
  })
})
