import { randomUUID } from 'node:crypto'
import { Logger, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ClsService } from 'nestjs-cls'
import { AppModule } from '../../src/app.module'
import type { StoreContexto } from '../../src/infra/contexto/contexto-atletica.service'
import { ErroAtleticaContextoAusente } from '../../src/infra/contexto/erros'
import { TransacaoService } from '../../src/infra/eventos/apos-commit'
import { ErroAuditoriaImutavel } from '../../src/infra/prisma/erros'
import { PrismaService, type TransacaoComEscopo } from '../../src/infra/prisma/prisma.service'
import {
  AuditoriaService,
  type EntradaAuditoria,
} from '../../src/modules/auditoria/auditoria.service'
import { diferenca } from '../../src/modules/auditoria/diferenca'
import { ErroAuditoria } from '../../src/modules/auditoria/erros'
import { prepararAtleticaPadrao } from '../fabricas/atletica'
import { proximaSequencia } from '../fabricas/sequencia'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { prismaTeste } from '../setup/prisma-teste'

// TODO: trocar pelas fábricas de domínio quando existirem (times → #63, eventos → #70).
async function criarEvento(diretor: UsuarioCriado) {
  const modalidade = await prismaTeste.modalidade.create({
    data: { nome: `Modalidade ${proximaSequencia()}`, icone: 'bola' },
  })
  const time = await prismaTeste.time.create({
    data: { atleticaId: diretor.atleticaId, modalidadeId: modalidade.id, nome: 'Time' },
  })
  return prismaTeste.evento.create({
    data: {
      atleticaId: diretor.atleticaId,
      tipo: 'TREINO',
      timeId: time.id,
      inicio: new Date('2026-10-01T22:00:00.000Z'),
      local: 'Ginásio A',
      criadoPorId: diretor.id,
    },
  })
}

interface Contexto {
  atleticaId?: string
  usuarioId?: string
  requestId?: string
}

describe('AuditoriaService (integração)', () => {
  let app: INestApplication
  let cls: ClsService<StoreContexto>
  let prisma: PrismaService
  let transacao: TransacaoService
  let auditoria: AuditoriaService
  let diretor: UsuarioCriado

  beforeAll(async () => {
    await prepararAtleticaPadrao()
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = modulo.createNestApplication({ logger: false })
    await app.init()
    cls = app.get(ClsService)
    prisma = app.get(PrismaService)
    transacao = app.get(TransacaoService)
    auditoria = app.get(AuditoriaService)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    diretor = await criarUsuario({ papel: 'DIRETOR' })
  })

  function comContexto<T>(contexto: Contexto, fn: () => Promise<T>): Promise<T> {
    return cls.run(async () => {
      cls.set('atleticaId', contexto.atleticaId)
      cls.set('usuarioId', contexto.usuarioId)
      cls.set('requestId', contexto.requestId)
      return await fn()
    })
  }

  function doDiretor<T>(fn: () => Promise<T>): Promise<T> {
    return comContexto({ atleticaId: diretor.atleticaId, usuarioId: diretor.id }, fn)
  }

  function alterarLocal(eventoId: string, local: string, depois?: () => void) {
    return transacao.executar(async (tx) => {
      const antes = await tx.evento.findUniqueOrThrow({ where: { id: eventoId } })
      const alterado = await tx.evento.update({ where: { id: eventoId }, data: { local } })
      const diff = diferenca(antes, alterado, ['inicio', 'local', 'observacoes'])
      if (diff) {
        await auditoria.registrar(tx, {
          acao: 'EVENTO_ALTERADO',
          entidade: 'Evento',
          entidadeId: eventoId,
          dados: diff,
        })
      }
      depois?.()
    })
  }

  function entradaEvento(
    eventoId: string,
    extra: Partial<EntradaAuditoria> = {},
  ): EntradaAuditoria {
    return {
      acao: 'EVENTO_CANCELADO',
      entidade: 'Evento',
      entidadeId: eventoId,
      dados: { antes: { status: 'AGENDADO' }, depois: { status: 'CANCELADO' } },
      ...extra,
    } as EntradaAuditoria
  }

  it('grava ator, atlética, requestId e só os campos alterados (critério 1)', async () => {
    const evento = await criarEvento(diretor)
    await comContexto(
      { atleticaId: diretor.atleticaId, usuarioId: diretor.id, requestId: 'req-1' },
      () => alterarLocal(evento.id, 'Ginásio B'),
    )

    const registros = await prismaTeste.registroAuditoria.findMany()
    expect(registros).toEqual([
      expect.objectContaining({
        atleticaId: diretor.atleticaId,
        usuarioId: diretor.id,
        acao: 'EVENTO_ALTERADO',
        entidade: 'Evento',
        entidadeId: evento.id,
        dados: { antes: { local: 'Ginásio A' }, depois: { local: 'Ginásio B' } },
        requestId: 'req-1',
      }),
    ])
  })

  it('operação sem mudança não grava auditoria', async () => {
    const evento = await criarEvento(diretor)
    await doDiretor(() => alterarLocal(evento.id, 'Ginásio A'))
    expect(await prismaTeste.registroAuditoria.count()).toBe(0)
  })

  it('exceção depois de registrar desfaz alteração e auditoria (critério 2)', async () => {
    const evento = await criarEvento(diretor)
    await expect(
      doDiretor(() =>
        alterarLocal(evento.id, 'Ginásio B', () => {
          throw new Error('falha depois da auditoria')
        }),
      ),
    ).rejects.toThrow('falha depois da auditoria')

    expect(await prismaTeste.registroAuditoria.count()).toBe(0)
    expect(await prismaTeste.evento.findUniqueOrThrow({ where: { id: evento.id } })).toMatchObject({
      local: 'Ginásio A',
    })
  })

  it('falha na auditoria desfaz a alteração (critério 3)', async () => {
    const evento = await criarEvento(diretor)
    await expect(
      doDiretor(() =>
        transacao.executar(async (tx) => {
          await tx.evento.update({ where: { id: evento.id }, data: { local: 'Ginásio B' } })
          await auditoria.registrar(tx, entradaEvento('nao-e-uuid'))
        }),
      ),
    ).rejects.toThrow()

    expect(await prismaTeste.registroAuditoria.count()).toBe(0)
    expect(await prismaTeste.evento.findUniqueOrThrow({ where: { id: evento.id } })).toMatchObject({
      local: 'Ginásio A',
    })
  })

  it('não grava email nem senhaHash e loga warn (critério 4)', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    const evento = await criarEvento(diretor)
    await doDiretor(() =>
      transacao.executar((tx) =>
        auditoria.registrar(
          tx,
          entradaEvento(evento.id, {
            dados: { antes: null, depois: { email: diretor.email, senhaHash: 'h', local: 'X' } },
          }),
        ),
      ),
    )
    const registro = await prismaTeste.registroAuditoria.findFirstOrThrow()
    expect(registro.dados).toEqual({ antes: null, depois: { local: 'X' } })
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ removidos: ['depois.email', 'depois.senhaHash'] }),
      expect.any(String),
    )
    warn.mockRestore()
  })

  describe('registrarVarios', () => {
    /** Conta as chamadas a `createMany`: cada uma é uma única instrução INSERT no Postgres. */
    function contarInserts(tx: TransacaoComEscopo) {
      const createMany = jest.fn(
        (args: Parameters<TransacaoComEscopo['registroAuditoria']['createMany']>[0]) =>
          tx.registroAuditoria.createMany(args),
      )
      return {
        tx: { registroAuditoria: { createMany } } as unknown as TransacaoComEscopo,
        createMany,
      }
    }

    async function gravar(quantidade: number): Promise<number> {
      const evento = await criarEvento(diretor)
      return doDiretor(() =>
        transacao.executar(async (tx) => {
          const contador = contarInserts(tx)
          const entradas = Array.from({ length: quantidade }, () => entradaEvento(evento.id))
          await auditoria.registrarVarios(contador.tx, entradas)
          return contador.createMany.mock.calls.length
        }),
      )
    }

    it.each([
      [0, 0],
      [1, 1],
      [185, 1],
      [501, 2],
    ])('%i entradas → %i INSERT(s) (critério 5)', async (quantidade, inserts) => {
      expect(await gravar(quantidade)).toBe(inserts)
      expect(await prismaTeste.registroAuditoria.count()).toBe(quantidade)
    })
  })

  it('job grava com ator nulo; sem usuarioId lança erro (critério 6)', async () => {
    const evento = await criarEvento(diretor)
    const job = (entrada: EntradaAuditoria) =>
      comContexto({ atleticaId: diretor.atleticaId }, () =>
        transacao.executar((tx) => auditoria.registrar(tx, entrada)),
      )

    await job(entradaEvento(evento.id, { usuarioId: null }))
    await expect(job(entradaEvento(evento.id))).rejects.toThrow(ErroAuditoria)

    const registros = await prismaTeste.registroAuditoria.findMany()
    expect(registros).toEqual([expect.objectContaining({ usuarioId: null })])
  })

  it('sem atlética no contexto → ErroAtleticaContextoAusente', async () => {
    await expect(
      comContexto({ usuarioId: diretor.id }, () =>
        transacao.executar((tx) => auditoria.registrar(tx, entradaEvento(randomUUID()))),
      ),
    ).rejects.toThrow(ErroAtleticaContextoAusente)
  })

  describe('imutabilidade (critério 7)', () => {
    let id: string

    beforeEach(async () => {
      const evento = await criarEvento(diretor)
      await doDiretor(() =>
        transacao.executar((tx) => auditoria.registrar(tx, entradaEvento(evento.id))),
      )
      id = (await prismaTeste.registroAuditoria.findFirstOrThrow()).id
    })

    it.each(['db', 'semEscopo'] as const)(
      'extensão rejeita update e delete via %s',
      async (cliente) => {
        await doDiretor(async () => {
          const delegate = prisma[cliente].registroAuditoria
          const where = { id }
          await expect(delegate.update({ where, data: { acao: 'X' } })).rejects.toThrow(
            ErroAuditoriaImutavel,
          )
          await expect(delegate.updateMany({ where, data: { acao: 'X' } })).rejects.toThrow(
            ErroAuditoriaImutavel,
          )
          await expect(delegate.delete({ where })).rejects.toThrow(ErroAuditoriaImutavel)
          await expect(delegate.deleteMany({ where })).rejects.toThrow(ErroAuditoriaImutavel)
          await expect(
            delegate.upsert({ where, create: entradaBruta(), update: { acao: 'X' } }),
          ).rejects.toThrow(ErroAuditoriaImutavel)
        })
        expect(await prismaTeste.registroAuditoria.count()).toBe(1)
      },
    )

    function entradaBruta() {
      return {
        atleticaId: diretor.atleticaId,
        acao: 'X',
        entidade: 'Evento',
        entidadeId: randomUUID(),
        dados: {},
      }
    }

    it('trigger rejeita UPDATE e DELETE em SQL cru', async () => {
      await expect(
        prismaTeste.$executeRaw`UPDATE "RegistroAuditoria" SET "acao" = 'X' WHERE "id" = ${id}::uuid`,
      ).rejects.toThrow(/imutável/)
      await expect(
        prismaTeste.$executeRaw`DELETE FROM "RegistroAuditoria" WHERE "id" = ${id}::uuid`,
      ).rejects.toThrow(/imutável/)
      expect(
        await prismaTeste.registroAuditoria.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        acao: 'EVENTO_CANCELADO',
      })
    })
  })

  it('nenhum registro de uma pessoa contém nome ou e-mail (critério 10)', async () => {
    const atleta = await criarUsuario({ atleticaId: diretor.atleticaId, nome: 'Fulana de Tal' })
    const vinculoId = atleta.vinculo.id
    await doDiretor(() =>
      transacao.executar((tx) =>
        auditoria.registrarVarios(tx, [
          {
            acao: 'CARGO_ALTERADO',
            entidade: 'VinculoAtletica',
            entidadeId: vinculoId,
            dados: {
              antes: { papel: 'ATLETA', nome: atleta.nome },
              depois: { papel: 'DIRETOR', email: atleta.email },
              contexto: { usuarioId: atleta.id, usuario: { nome: atleta.nome, fotoKey: 'k' } },
            },
          },
          {
            acao: 'CONTA_EXCLUIDA',
            entidade: 'Usuario',
            entidadeId: atleta.id,
            dados: { antes: { nome: atleta.nome, email: atleta.email }, depois: null },
          },
        ]),
      ),
    )

    const registros = await prismaTeste.registroAuditoria.findMany()
    expect(registros).toHaveLength(2)
    const texto = JSON.stringify(registros)
    expect(texto).not.toContain(atleta.nome)
    expect(texto).not.toContain(atleta.email)
    expect(texto).toContain(atleta.id)
  })
})
