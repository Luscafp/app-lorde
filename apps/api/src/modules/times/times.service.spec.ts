import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import type { ErroNegocio } from '../../common/erros/erro-negocio'
import { Prisma } from '../../generated/prisma/client'
import type { PrismaService } from '../../infra/prisma/prisma.service'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import { TimesService } from './times.service'

const ATUAL = 'a1a1a1a1-0000-4000-8000-000000000001'
const ADVERSARIA = 'a2a2a2a2-0000-4000-8000-000000000002'
const ID = 'b1b1b1b1-0000-4000-8000-000000000001'
const FUTSAL = 'c1c1c1c1-0000-4000-8000-000000000001'
const VOLEI = 'c2c2c2c2-0000-4000-8000-000000000002'

function linha(dados: Record<string, unknown> = {}) {
  const atleticaId = (dados.atleticaId as string | undefined) ?? ATUAL
  return {
    id: ID,
    nome: 'Futsal Masculino',
    ativo: true,
    atleticaId,
    modalidadeId: FUTSAL,
    modalidade: { id: FUTSAL, nome: 'Futsal', icone: 'soccer' },
    atletica: { id: atleticaId, nome: 'Atlética', sigla: 'ATL' },
    capitao: { id: 'u1', nome: 'Ana' },
    _count: { membros: 3 },
    ...dados,
  }
}

function erroPrisma(code: string) {
  return new PrismaClientKnownRequestError('falha', { code, clientVersion: '7' })
}

interface Cenario {
  atual?: ReturnType<typeof linha> | null
  adversaria?: { id: string } | null
  modalidade?: { ativa: boolean } | null
  eventos?: number
  membros?: number
  solicitacoes?: number
}

function criarServico(cenario: Cenario = {}) {
  const atual = cenario.atual === undefined ? linha() : cenario.atual
  const tx = {
    time: {
      findUnique: jest.fn().mockResolvedValue(atual),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(linha({ ...data, capitao: null, _count: { membros: 0 } })),
      ),
      update: jest.fn(({ data }: { data: object }) => Promise.resolve({ ...atual, ...data })),
      delete: jest.fn().mockResolvedValue(atual),
    },
    atletica: { findFirst: jest.fn().mockResolvedValue(cenario.adversaria ?? null) },
    modalidade: {
      findUnique: jest
        .fn()
        .mockResolvedValue(cenario.modalidade === undefined ? { ativa: true } : cenario.modalidade),
    },
    evento: { count: jest.fn().mockResolvedValue(cenario.eventos ?? 0) },
    membroTime: { count: jest.fn().mockResolvedValue(cenario.membros ?? 0) },
    solicitacaoEntrada: { count: jest.fn().mockResolvedValue(cenario.solicitacoes ?? 0) },
  }
  const db = {
    time: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(atual),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  const auditoria = { registrar: jest.fn(), registrarVarios: jest.fn() }
  const servico = new TimesService(
    { db } as unknown as PrismaService,
    auditoria as unknown as AuditoriaService,
  )
  return { servico, tx, db, auditoria }
}

async function codigoDe(promessa: Promise<unknown>): Promise<string> {
  const erro = (await promessa.then(
    () => {
      throw new Error('esperava erro')
    },
    (e: unknown) => e,
  )) as ErroNegocio
  return erro.code
}

const PAGINA = { page: 1, limit: 20, escopo: 'PROPRIOS', incluirInativos: false } as const

describe('TimesService', () => {
  describe('listar', () => {
    function consultaDaPagina(db: ReturnType<typeof criarServico>['db']) {
      const [partes, ...valores] = db.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ]
      return Prisma.sql(partes, ...valores)
    }

    it('pagina em SQL e devolve os times na ordem dos ids', async () => {
      const { servico, db } = criarServico()
      const outro = 'b2b2b2b2-0000-4000-8000-000000000002'
      db.$queryRaw.mockResolvedValueOnce([{ id: outro }, { id: ID }])
      db.$queryRaw.mockResolvedValueOnce([{ total: 22n }])
      db.time.findMany.mockResolvedValue([linha(), linha({ id: outro, nome: 'Basquete' })])

      const resposta = await servico.listar(ATUAL, { ...PAGINA, page: 2 })

      expect(resposta).toMatchObject({ page: 2, limit: 20, total: 22 })
      expect(resposta.items.map(({ id }) => id)).toEqual([outro, ID])
      expect(db.time.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [outro, ID] } } }),
      )
      const consulta = consultaDaPagina(db)
      expect(consulta.sql).toContain('t."ativo" AND m."ativa"')
      expect(consulta.values).toEqual([ATUAL, 20, 20])
    })

    it('ADVERSARIOS + filtros + incluirInativos + busca sem acento', async () => {
      const { servico, db } = criarServico()
      await servico.listar(ATUAL, {
        ...PAGINA,
        escopo: 'ADVERSARIOS',
        incluirInativos: true,
        modalidadeId: FUTSAL,
        atleticaId: ADVERSARIA,
        q: '50%',
      })
      const consulta = consultaDaPagina(db)
      expect(consulta.sql).toContain('a."usaAplicativo" = false')
      expect(consulta.sql).toContain('unaccent(lower(t."nome")) LIKE')
      expect(consulta.sql).not.toContain('m."ativa"')
      expect(consulta.values).toEqual([FUTSAL, ADVERSARIA, '%50\\%%', 20, 0])
    })

    it('time adversário sai com capitão nulo e zero membros', async () => {
      const { servico, db } = criarServico()
      db.$queryRaw.mockResolvedValueOnce([{ id: ID }])
      db.$queryRaw.mockResolvedValueOnce([{ total: 1n }])
      db.time.findMany.mockResolvedValue([linha({ atleticaId: ADVERSARIA })])
      const [item] = (await servico.listar(ATUAL, PAGINA)).items
      expect(item).toMatchObject({
        atletica: { id: ADVERSARIA, propria: false },
        capitao: null,
        totalMembros: 0,
      })
    })
  })

  describe('detalhar', () => {
    it('fora da Diretoria exige time e modalidade ativos', async () => {
      const { servico, db } = criarServico()
      const time = await servico.detalhar(ID, ATUAL, false)
      expect(time).toMatchObject({
        atletica: { propria: true },
        capitao: { id: 'u1', nome: 'Ana' },
        totalMembros: 3,
      })
      expect(db.time.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ID, ativo: true, modalidade: { ativa: true } },
        }),
      )
    })

    it('inexistente → NOT_FOUND', async () => {
      const { servico } = criarServico({ atual: null })
      await expect(codigoDe(servico.detalhar(ID, ATUAL, true))).resolves.toBe('NOT_FOUND')
    })
  })

  describe('criar', () => {
    it('sem adversária: time da atlética ativa, auditado na mesma transação', async () => {
      const { servico, tx, auditoria } = criarServico()
      const time = await servico.criar(ATUAL, { nome: 'Futsal Masculino', modalidadeId: FUTSAL })

      expect(time).toMatchObject({ atletica: { propria: true }, ativo: true, capitao: null })
      expect(tx.atletica.findFirst).not.toHaveBeenCalled()
      expect(tx.time.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { nome: 'Futsal Masculino', modalidadeId: FUTSAL, atleticaId: ATUAL },
        }),
      )
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'Time',
        acao: 'TIME_CRIADO',
        entidadeId: ID,
        dados: {
          antes: null,
          depois: {
            nome: 'Futsal Masculino',
            modalidadeId: FUTSAL,
            atleticaId: ATUAL,
            ativo: true,
          },
        },
      })
    })

    it('com adversária sem app: time da adversária', async () => {
      const { servico, tx } = criarServico({ adversaria: { id: ADVERSARIA } })
      const time = await servico.criar(ATUAL, {
        nome: 'Fênix Futsal',
        modalidadeId: FUTSAL,
        atleticaAdversariaId: ADVERSARIA,
      })
      expect(time.atletica).toMatchObject({ id: ADVERSARIA, propria: false })
      expect(tx.atletica.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ADVERSARIA, usaAplicativo: false } }),
      )
    })

    it('adversária inexistente ou com usaAplicativo = true → NOT_FOUND sem gravar', async () => {
      const { servico, tx, auditoria } = criarServico({ adversaria: null })
      const criacao = servico.criar(ATUAL, {
        nome: 'Futsal',
        modalidadeId: FUTSAL,
        atleticaAdversariaId: ATUAL,
      })
      await expect(codigoDe(criacao)).resolves.toBe('NOT_FOUND')
      expect(tx.time.create).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
    })

    it.each([
      ['inativa', { ativa: false }, 'MODALIDADE_INATIVA'],
      ['inexistente', null, 'NOT_FOUND'],
    ])('modalidade %s → %s', async (_caso, modalidade, codigo) => {
      const { servico, tx } = criarServico({ modalidade })
      const criacao = servico.criar(ATUAL, { nome: 'Futsal', modalidadeId: FUTSAL })
      await expect(codigoDe(criacao)).resolves.toBe(codigo)
      expect(tx.time.create).not.toHaveBeenCalled()
    })

    it('P2002 (time_nome_unico) → TIME_DUPLICADO', async () => {
      const { servico, tx } = criarServico()
      tx.time.create.mockRejectedValue(erroPrisma('P2002'))
      const criacao = servico.criar(ATUAL, { nome: 'Futsal', modalidadeId: FUTSAL })
      await expect(codigoDe(criacao)).resolves.toBe('TIME_DUPLICADO')
    })
  })

  describe('atualizar', () => {
    it('sem mudança → devolve o time sem gravar nem auditar', async () => {
      const { servico, tx, auditoria } = criarServico()
      await servico.atualizar(ID, ATUAL, { nome: 'Futsal Masculino', ativo: true })
      expect(tx.time.update).not.toHaveBeenCalled()
      expect(auditoria.registrarVarios).not.toHaveBeenCalled()
    })

    it('nome e ativo → TIME_ALTERADO e TIME_DESATIVADO só com os campos alterados', async () => {
      const { servico, tx, auditoria } = criarServico()
      await servico.atualizar(ID, ATUAL, { nome: 'Futsal Misto', ativo: false })

      expect(tx.evento.count).not.toHaveBeenCalled()
      expect(auditoria.registrarVarios).toHaveBeenCalledWith(tx, [
        {
          entidade: 'Time',
          entidadeId: ID,
          acao: 'TIME_ALTERADO',
          dados: { antes: { nome: 'Futsal Masculino' }, depois: { nome: 'Futsal Misto' } },
        },
        {
          entidade: 'Time',
          entidadeId: ID,
          acao: 'TIME_DESATIVADO',
          dados: { antes: { ativo: true }, depois: { ativo: false } },
        },
      ])
    })

    it('reativar → TIME_ATIVADO', async () => {
      const { servico, auditoria, tx } = criarServico({ atual: linha({ ativo: false }) })
      await servico.atualizar(ID, ATUAL, { ativo: true })
      expect(auditoria.registrarVarios).toHaveBeenCalledWith(tx, [
        expect.objectContaining({ acao: 'TIME_ATIVADO' }),
      ])
    })

    it('troca de modalidade sem eventos é aceita', async () => {
      const { servico, tx, auditoria } = criarServico()
      await servico.atualizar(ID, ATUAL, { modalidadeId: VOLEI })

      expect(tx.evento.count).toHaveBeenCalledWith({
        where: { OR: [{ timeId: ID }, { timeAdversarioId: ID }] },
      })
      expect(tx.time.update).toHaveBeenCalled()
      expect(auditoria.registrarVarios).toHaveBeenCalledWith(tx, [
        expect.objectContaining({
          acao: 'TIME_ALTERADO',
          dados: { antes: { modalidadeId: FUTSAL }, depois: { modalidadeId: VOLEI } },
        }),
      ])
    })

    it.each(['timeId', 'timeAdversarioId'] as const)(
      'troca de modalidade com evento como %s → TIME_COM_EVENTOS',
      async (campo) => {
        const { servico, tx } = criarServico()
        tx.evento.count.mockImplementation(({ where }: { where: Prisma.EventoWhereInput }) =>
          Promise.resolve(where.OR?.some((condicao) => condicao[campo] === ID) ? 1 : 0),
        )
        const troca = servico.atualizar(ID, ATUAL, { modalidadeId: VOLEI })
        await expect(codigoDe(troca)).resolves.toBe('TIME_COM_EVENTOS')
        expect(tx.time.update).not.toHaveBeenCalled()
      },
    )

    it('troca para modalidade inativa → MODALIDADE_INATIVA', async () => {
      const { servico } = criarServico({ modalidade: { ativa: false } })
      const troca = servico.atualizar(ID, ATUAL, { modalidadeId: VOLEI })
      await expect(codigoDe(troca)).resolves.toBe('MODALIDADE_INATIVA')
    })

    it('inexistente ou de outra atlética com app → NOT_FOUND', async () => {
      const { servico } = criarServico({ atual: null })
      await expect(codigoDe(servico.atualizar(ID, ATUAL, { ativo: false }))).resolves.toBe(
        'NOT_FOUND',
      )
    })

    it('P2002 ao renomear → TIME_DUPLICADO', async () => {
      const { servico, tx } = criarServico()
      tx.time.update.mockRejectedValue(erroPrisma('P2002'))
      await expect(codigoDe(servico.atualizar(ID, ATUAL, { nome: 'Outro' }))).resolves.toBe(
        'TIME_DUPLICADO',
      )
    })
  })

  describe('excluir', () => {
    it('sem dependências: exclusão física e TIME_EXCLUIDO no mesmo tx', async () => {
      const { servico, tx, auditoria } = criarServico()
      await servico.excluir(ID)

      expect(tx.time.delete).toHaveBeenCalledWith({ where: { id: ID } })
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'Time',
        acao: 'TIME_EXCLUIDO',
        entidadeId: ID,
        dados: {
          antes: {
            nome: 'Futsal Masculino',
            modalidadeId: FUTSAL,
            atleticaId: ATUAL,
            ativo: true,
          },
          depois: null,
        },
      })
    })

    it.each([
      ['evento (inclusive cancelado)', { eventos: 1 }],
      ['membro (inclusive histórico)', { membros: 1 }],
      ['solicitação (inclusive rejeitada)', { solicitacoes: 1 }],
    ])('com %s → TIME_COM_DEPENDENCIAS', async (_caso, cenario) => {
      const { servico, tx, auditoria } = criarServico(cenario)
      await expect(codigoDe(servico.excluir(ID))).resolves.toBe('TIME_COM_DEPENDENCIAS')
      expect(tx.time.delete).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
    })

    it('contagens sem filtro de status (qualquer evento, membro ou solicitação)', async () => {
      const { servico, tx } = criarServico()
      await servico.excluir(ID)
      expect(tx.membroTime.count).toHaveBeenCalledWith({ where: { timeId: ID } })
      expect(tx.solicitacaoEntrada.count).toHaveBeenCalledWith({ where: { timeId: ID } })
    })

    it('P2003 (dependência fora do escopo) → TIME_COM_DEPENDENCIAS', async () => {
      const { servico, tx } = criarServico()
      tx.time.delete.mockRejectedValue(erroPrisma('P2003'))
      await expect(codigoDe(servico.excluir(ID))).resolves.toBe('TIME_COM_DEPENDENCIAS')
    })

    it('inexistente → NOT_FOUND', async () => {
      const { servico } = criarServico({ atual: null })
      await expect(codigoDe(servico.excluir(ID))).resolves.toBe('NOT_FOUND')
    })
  })
})
