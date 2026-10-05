import type { ErroNegocio } from '../../common/erros/erro-negocio'
import { Prisma } from '../../generated/prisma/client'
import type { PrismaService } from '../../infra/prisma/prisma.service'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import { AtleticasAdversariasService } from './atleticas-adversarias.service'

const ID = 'a2a2a2a2-0000-4000-8000-000000000002'
const FENIX = { id: ID, nome: 'Atlética Fênix', sigla: 'FNX', curso: null, _count: { times: 2 } }

function criarServico({
  atual = FENIX,
  duplicada = false,
}: { atual?: typeof FENIX | null; duplicada?: boolean } = {}) {
  const tx = {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue(duplicada ? [{ id: 'outra' }] : []),
    atletica: {
      findFirst: jest.fn().mockResolvedValue(atual),
      create: jest.fn(
        ({ data: { usaAplicativo: _, ...data } }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: ID, _count: { times: 0 }, ...data }),
      ),
      update: jest.fn(({ data }: { data: object }) => Promise.resolve({ ...atual, ...data })),
    },
  }
  const db = {
    atletica: { findMany: jest.fn().mockResolvedValue([FENIX]) },
    $queryRaw: jest.fn(),
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  const auditoria = { registrar: jest.fn() }
  const servico = new AtleticasAdversariasService(
    { db } as unknown as PrismaService,
    auditoria as unknown as AuditoriaService,
  )
  return { servico, tx, db, auditoria }
}

async function codigoDe(promessa: Promise<unknown>): Promise<string | undefined> {
  return promessa.then(
    () => undefined,
    (erro: unknown) => (erro as ErroNegocio).code,
  )
}

describe('AtleticasAdversariasService', () => {
  it('listar: só usaAplicativo = false, busca sem acento e totalTimes', async () => {
    const { servico, db } = criarServico()
    db.$queryRaw.mockResolvedValueOnce([{ id: ID }])
    db.$queryRaw.mockResolvedValueOnce([{ total: 1n }])
    const resposta = await servico.listar({ q: 'fenix', page: 1, limit: 20 })

    expect(resposta).toEqual({
      items: [{ id: ID, nome: 'Atlética Fênix', sigla: 'FNX', curso: null, totalTimes: 2 }],
      page: 1,
      limit: 20,
      total: 1,
    })
    expect(db.atletica.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [ID] } } }),
    )
    const [partes, ...valores] = db.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]]
    const consulta = Prisma.sql(partes, ...valores)
    expect(consulta.sql).toContain('"usaAplicativo" = false')
    expect(consulta.values).toEqual(['%fenix%', 20, 0])
  })

  it('criar: grava usaAplicativo = false sob lock e audita no mesmo tx', async () => {
    const { servico, tx, auditoria } = criarServico()
    const criada = await servico.criar({ nome: 'Atlética Fênix', sigla: 'FNX', curso: null })

    expect(criada).toEqual({
      id: ID,
      nome: 'Atlética Fênix',
      sigla: 'FNX',
      curso: null,
      totalTimes: 0,
    })
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    expect(tx.atletica.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { nome: 'Atlética Fênix', sigla: 'FNX', curso: null, usaAplicativo: false },
      }),
    )
    expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
      entidade: 'Atletica',
      acao: 'ATLETICA_ADVERSARIA_CRIADA',
      entidadeId: ID,
      dados: { antes: null, depois: { nome: 'Atlética Fênix', sigla: 'FNX', curso: null } },
    })
  })

  it('criar com nome já usado (sem diferenciar caixa) → ATLETICA_DUPLICADA', async () => {
    const { servico, tx } = criarServico({ duplicada: true })
    const criacao = servico.criar({ nome: 'atlética fênix', sigla: null, curso: null })
    await expect(codigoDe(criacao)).resolves.toBe('ATLETICA_DUPLICADA')
    expect(tx.atletica.create).not.toHaveBeenCalled()
  })

  it('atualizar: só os campos alterados em ATLETICA_ADVERSARIA_ALTERADA', async () => {
    const { servico, tx, auditoria } = criarServico()
    await servico.atualizar(ID, { sigla: 'FNX', curso: 'Direito' })

    expect(tx.$queryRaw).not.toHaveBeenCalled()
    expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
      entidade: 'Atletica',
      acao: 'ATLETICA_ADVERSARIA_ALTERADA',
      entidadeId: ID,
      dados: { antes: { curso: null }, depois: { curso: 'Direito' } },
    })
  })

  it('atualizar sem mudança → não grava nem audita', async () => {
    const { servico, tx, auditoria } = criarServico()
    await servico.atualizar(ID, { nome: 'Atlética Fênix' })
    expect(tx.atletica.update).not.toHaveBeenCalled()
    expect(auditoria.registrar).not.toHaveBeenCalled()
  })

  it('atualizar nome para um já usado → ATLETICA_DUPLICADA', async () => {
    const { servico } = criarServico({ duplicada: true })
    await expect(codigoDe(servico.atualizar(ID, { nome: 'Atlética Leão' }))).resolves.toBe(
      'ATLETICA_DUPLICADA',
    )
  })

  it('atualizar atlética que usa o aplicativo ou inexistente → NOT_FOUND', async () => {
    const { servico, tx } = criarServico({ atual: null })
    await expect(codigoDe(servico.atualizar(ID, { sigla: 'X' }))).resolves.toBe('NOT_FOUND')
    expect(tx.atletica.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ID, usaAplicativo: false } }),
    )
  })
})
