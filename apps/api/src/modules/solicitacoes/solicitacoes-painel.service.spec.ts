import { codigoDaRejeicao } from '../../../test/suporte/codigo-do-erro'
import type { Prisma } from '../../generated/prisma/client'
import type { TransacaoService } from '../../infra/eventos/apos-commit'
import type { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import type { PrismaService } from '../../infra/prisma/prisma.service'
import type { AuditoriaService, EntradaAuditoria } from '../auditoria/auditoria.service'
import type { UploadsService } from '../uploads/uploads.service'
import { SolicitacoesPainelService } from './solicitacoes-painel.service'

const ATLETICA = 'a1a1a1a1-0000-4000-8000-000000000001'
const TIME = 'b1b1b1b1-0000-4000-8000-000000000001'
const ATLETA = 'c1c1c1c1-0000-4000-8000-000000000001'
const DIRETOR = 'd1d1d1d1-0000-4000-8000-000000000001'
const SOLICITACAO = 'e1e1e1e1-0000-4000-8000-000000000001'
const MEMBRO = 'f1f1f1f1-0000-4000-8000-000000000001'
const CRIADA_EM = new Date('2026-09-28T12:00:00.000Z')
const AVALIADA_EM = new Date('2026-09-30T15:00:00.000Z')
const ENTRADA_EM = new Date('2026-09-30T15:00:00.000Z')

type Status = 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'CANCELADA'

interface Cenario {
  existe?: boolean
  timeAtivo?: boolean
  modalidadeAtiva?: boolean
  /** Status encontrado quando a transição condicional não atualiza nada. */
  atual?: Status | null
  jaEraMembro?: boolean
}

const pessoa = (id: string, nome: string) => ({ id, nome, fotoKey: null, excluidoEm: null })

function linhaItem(status: Status) {
  const avaliada = status === 'APROVADA' || status === 'REJEITADA'
  return {
    id: SOLICITACAO,
    status,
    criadaEm: CRIADA_EM,
    avaliadaEm: avaliada ? AVALIADA_EM : null,
    canceladaEm: null,
    usuario: pessoa(ATLETA, 'Carlos Lima'),
    avaliadoPor: avaliada ? pessoa(DIRETOR, 'Maria Diretora') : null,
    time: {
      id: TIME,
      nome: 'Futsal Masculino',
      modalidade: { id: 'm1', nome: 'Futsal', icone: 'soccer' },
    },
  }
}

function criarServico(cenario: Cenario = {}) {
  const { existe = true, timeAtivo = true, modalidadeAtiva = true, atual } = cenario
  const transicao = atual === undefined
  const solicitacao = { id: SOLICITACAO, atleticaId: ATLETICA, timeId: TIME, usuarioId: ATLETA }
  let statusFinal: Status = 'PENDENTE'
  const tx = {
    solicitacaoEntrada: {
      findUnique: jest.fn((args: { select: { time?: unknown } }) => {
        if (!existe) return Promise.resolve(null)
        if (args.select.time) {
          return Promise.resolve({
            time: { ativo: timeAtivo, modalidade: { ativa: modalidadeAtiva } },
          })
        }
        return Promise.resolve(atual === null ? null : { status: atual })
      }),
      updateManyAndReturn: jest.fn((args: { data: { status: Status } }) => {
        if (!transicao) return Promise.resolve([])
        statusFinal = args.data.status
        return Promise.resolve([solicitacao])
      }),
      findUniqueOrThrow: jest.fn(() => Promise.resolve(linhaItem(statusFinal))),
    },
    membroTime: {
      createManyAndReturn: jest
        .fn()
        .mockResolvedValue(cenario.jaEraMembro ? [] : [{ id: MEMBRO, entradaEm: ENTRADA_EM }]),
    },
  }
  const db = {
    $queryRaw: jest.fn(),
    solicitacaoEntrada: { findMany: jest.fn() },
  }
  const transacao = { executar: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) }
  const auditoria = {
    registrar: jest.fn(),
    registrarVarios: jest.fn((_tx: unknown, _entradas: EntradaAuditoria[]) => Promise.resolve()),
  }
  const eventos = { emitirAposCommit: jest.fn() }
  const uploads = { urlPublica: jest.fn((chave: string | null) => chave && `https://img/${chave}`) }
  const servico = new SolicitacoesPainelService(
    { db } as unknown as PrismaService,
    transacao as unknown as TransacaoService,
    auditoria as unknown as AuditoriaService,
    eventos as unknown as EventosDominioService,
    uploads as unknown as UploadsService,
  )
  return { servico, tx, db, auditoria, eventos }
}

const EVENTO = {
  atleticaId: ATLETICA,
  solicitacaoId: SOLICITACAO,
  timeId: TIME,
  usuarioId: ATLETA,
  autorId: DIRETOR,
}

describe('SolicitacoesPainelService', () => {
  describe('aprovar', () => {
    it('transição condicional, MembroTime com solicitacaoId e duas auditorias no mesmo tx', async () => {
      const { servico, tx, auditoria, eventos } = criarServico()

      const item = await servico.aprovar(SOLICITACAO, DIRETOR)

      expect(item).toMatchObject({
        status: 'APROVADA',
        avaliadaEm: AVALIADA_EM.toISOString(),
        usuario: { id: ATLETA, nome: 'Carlos Lima', fotoUrl: null },
        avaliadoPor: { id: DIRETOR, nome: 'Maria Diretora', fotoUrl: null },
      })
      expect(tx.solicitacaoEntrada.updateManyAndReturn.mock.calls[0]?.[0]).toMatchObject({
        where: { id: SOLICITACAO, status: 'PENDENTE' },
        data: { status: 'APROVADA', avaliadoPorId: DIRETOR },
      })
      expect(tx.membroTime.createManyAndReturn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            { atleticaId: ATLETICA, timeId: TIME, usuarioId: ATLETA, solicitacaoId: SOLICITACAO },
          ],
          skipDuplicates: true,
        }),
      )
      expect(auditoria.registrarVarios).toHaveBeenCalledWith(tx, [
        {
          entidade: 'SolicitacaoEntrada',
          acao: 'SOLICITACAO_APROVADA',
          entidadeId: SOLICITACAO,
          dados: {
            antes: { status: 'PENDENTE' },
            depois: { status: 'APROVADA' },
            contexto: { timeId: TIME, usuarioId: ATLETA },
          },
        },
        {
          entidade: 'MembroTime',
          acao: 'MEMBRO_ADICIONADO',
          entidadeId: MEMBRO,
          dados: {
            antes: null,
            depois: { timeId: TIME, usuarioId: ATLETA, entradaEm: ENTRADA_EM },
            contexto: { solicitacaoId: SOLICITACAO },
          },
        },
      ])
      expect(eventos.emitirAposCommit).toHaveBeenCalledWith('solicitacao.avaliada', {
        ...EVENTO,
        status: 'APROVADA',
      })
    })

    it('já membro ativo (conflito no índice): sem novo vínculo, só a auditoria da solicitação com jaEraMembro', async () => {
      const { servico, auditoria } = criarServico({ jaEraMembro: true })

      await expect(servico.aprovar(SOLICITACAO, DIRETOR)).resolves.toMatchObject({
        status: 'APROVADA',
      })
      expect(auditoria.registrarVarios.mock.calls[0]?.[1]).toMatchObject([
        {
          acao: 'SOLICITACAO_APROVADA',
          dados: { contexto: { timeId: TIME, usuarioId: ATLETA, jaEraMembro: true } },
        },
      ])
      expect(auditoria.registrarVarios.mock.calls[0]?.[1]).toHaveLength(1)
    })

    it.each([
      ['time inativo', { timeAtivo: false }],
      ['modalidade inativa', { modalidadeAtiva: false }],
    ])('%s → 422 TIME_INATIVO, sem transição', async (_, cenario) => {
      const { servico, tx, eventos } = criarServico(cenario)

      await expect(codigoDaRejeicao(servico.aprovar(SOLICITACAO, DIRETOR))).resolves.toBe(
        'TIME_INATIVO',
      )
      expect(tx.solicitacaoEntrada.updateManyAndReturn).not.toHaveBeenCalled()
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })

    it('inexistente ou de outra atlética → 404', async () => {
      const { servico } = criarServico({ existe: false })
      await expect(codigoDaRejeicao(servico.aprovar(SOLICITACAO, DIRETOR))).resolves.toBe(
        'NOT_FOUND',
      )
    })

    it.each<[Status, string]>([
      ['CANCELADA', 'SOLICITACAO_CANCELADA'],
      ['APROVADA', 'SOLICITACAO_JA_AVALIADA'],
      ['REJEITADA', 'SOLICITACAO_JA_AVALIADA'],
    ])('já %s → %s, sem MembroTime, auditoria nem evento', async (atual, codigo) => {
      const { servico, tx, auditoria, eventos } = criarServico({ atual })

      await expect(codigoDaRejeicao(servico.aprovar(SOLICITACAO, DIRETOR))).resolves.toBe(codigo)
      expect(tx.membroTime.createManyAndReturn).not.toHaveBeenCalled()
      expect(auditoria.registrarVarios).not.toHaveBeenCalled()
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })

    it('falha na auditoria propaga e nada é emitido', async () => {
      const { servico, auditoria, eventos } = criarServico()
      auditoria.registrarVarios.mockRejectedValueOnce(new Error('falha simulada'))

      await expect(servico.aprovar(SOLICITACAO, DIRETOR)).rejects.toThrow('falha simulada')
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })
  })

  describe('rejeitar', () => {
    it('REJEITADA, sem MembroTime e sem checar o time; auditoria e evento com status', async () => {
      const { servico, tx, auditoria, eventos } = criarServico({ timeAtivo: false })

      await expect(servico.rejeitar(SOLICITACAO, DIRETOR)).resolves.toMatchObject({
        status: 'REJEITADA',
      })
      expect(tx.membroTime.createManyAndReturn).not.toHaveBeenCalled()
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'SolicitacaoEntrada',
        acao: 'SOLICITACAO_REJEITADA',
        entidadeId: SOLICITACAO,
        dados: {
          antes: { status: 'PENDENTE' },
          depois: { status: 'REJEITADA' },
          contexto: { timeId: TIME, usuarioId: ATLETA },
        },
      })
      expect(eventos.emitirAposCommit).toHaveBeenCalledWith('solicitacao.avaliada', {
        ...EVENTO,
        status: 'REJEITADA',
      })
    })

    it.each<[Status | null, string]>([
      ['CANCELADA', 'SOLICITACAO_CANCELADA'],
      ['APROVADA', 'SOLICITACAO_JA_AVALIADA'],
      [null, 'NOT_FOUND'],
    ])('atual %s → %s', async (atual, codigo) => {
      const { servico, auditoria } = criarServico({ atual })

      await expect(codigoDaRejeicao(servico.rejeitar(SOLICITACAO, DIRETOR))).resolves.toBe(codigo)
      expect(auditoria.registrar).not.toHaveBeenCalled()
    })
  })

  describe('listar', () => {
    function comPagina(servicoEDb: ReturnType<typeof criarServico>, total: number) {
      servicoEDb.db.$queryRaw
        .mockResolvedValueOnce([{ id: SOLICITACAO }])
        .mockResolvedValueOnce([{ total: BigInt(total) }])
      servicoEDb.db.solicitacaoEntrada.findMany.mockResolvedValue([linhaItem('PENDENTE')])
      return servicoEDb
    }

    const sqlDa = (db: ReturnType<typeof criarServico>['db']) =>
      (db.$queryRaw.mock.calls[0] as [unknown, Prisma.Sql])[1].sql

    it('pendentes: mais antigas primeiro, paginadas e sem e-mail', async () => {
      const { servico, db } = comPagina(criarServico(), 3)

      const lista = await servico.listar(ATLETICA, { status: ['PENDENTE'], page: 1, limit: 20 })

      expect(lista).toMatchObject({ page: 1, limit: 20, total: 3 })
      expect(lista.items[0]?.usuario).toEqual({ id: ATLETA, nome: 'Carlos Lima', fotoUrl: null })
      expect(sqlDa(db)).toContain('ORDER BY s."criadaEm" ASC')
    })

    it('histórico: data de encerramento mais recente primeiro, com filtro de time', async () => {
      const { servico, db } = comPagina(criarServico(), 1)

      await servico.listar(ATLETICA, {
        status: ['APROVADA', 'REJEITADA', 'CANCELADA'],
        timeId: TIME,
        page: 2,
        limit: 10,
      })

      const sql = sqlDa(db)
      expect(sql).toContain('COALESCE(s."avaliadaEm", s."canceladaEm") DESC')
      expect(sql).toContain('s."timeId" =')
    })
  })
})
