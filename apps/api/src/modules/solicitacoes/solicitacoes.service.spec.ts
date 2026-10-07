import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { codigoDaRejeicao } from '../../../test/suporte/codigo-do-erro'
import type { TransacaoService } from '../../infra/eventos/apos-commit'
import type { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import type { PrismaService } from '../../infra/prisma/prisma.service'
import { SolicitacoesService } from './solicitacoes.service'

const ATUAL = 'a1a1a1a1-0000-4000-8000-000000000001'
const TIME = 'b1b1b1b1-0000-4000-8000-000000000001'
const EU = { id: 'u1u1u1u1-0000-4000-8000-000000000001', atleticaId: ATUAL }
const SOLICITACAO = 's1s1s1s1-0000-4000-8000-000000000001'
const CRIADA_EM = new Date('2026-09-30T14:00:00.000Z')
const CANCELADA_EM = new Date('2026-09-30T15:00:00.000Z')

type Status = 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'CANCELADA'

interface Cenario {
  time?: { ativo?: boolean; modalidadeAtiva?: boolean; usaAplicativo?: boolean } | null
  membro?: boolean
  pendente?: boolean
  atual?: Status | null
}

function linhaSolicitacao(status: Status) {
  return {
    id: SOLICITACAO,
    timeId: TIME,
    status,
    criadaEm: CRIADA_EM,
    canceladaEm: status === 'CANCELADA' ? CANCELADA_EM : null,
  }
}

function erroPrisma(code: string) {
  return new PrismaClientKnownRequestError('falha', { code, clientVersion: '7' })
}

function criarServico(cenario: Cenario = {}) {
  const { ativo = true, modalidadeAtiva = true, usaAplicativo = true } = cenario.time ?? {}
  const time =
    cenario.time === null
      ? null
      : { ativo, modalidade: { ativa: modalidadeAtiva }, atletica: { usaAplicativo } }
  const membros = cenario.membro ? 1 : 0
  const tx = {
    time: { findUnique: jest.fn().mockResolvedValue(time) },
    membroTime: { count: jest.fn().mockResolvedValue(membros) },
    solicitacaoEntrada: {
      count: jest.fn().mockResolvedValue(cenario.pendente ? 1 : 0),
      create: jest.fn().mockResolvedValue(linhaSolicitacao('PENDENTE')),
    },
  }
  const atual = cenario.atual === undefined ? 'CANCELADA' : cenario.atual
  const db = {
    membroTime: { count: jest.fn().mockResolvedValue(membros) },
    solicitacaoEntrada: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn((args: { select: { timeId?: boolean } }) => {
        if (args.select.timeId) return Promise.resolve(atual && linhaSolicitacao(atual))
        return Promise.resolve(cenario.pendente ? { id: SOLICITACAO, criadaEm: CRIADA_EM } : null)
      }),
    },
  }
  const transacao = { executar: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) }
  const eventos = { emitirAposCommit: jest.fn() }
  const servico = new SolicitacoesService(
    { db } as unknown as PrismaService,
    transacao as unknown as TransacaoService,
    eventos as unknown as EventosDominioService,
  )
  return { servico, tx, db, transacao, eventos }
}

describe('SolicitacoesService', () => {
  describe('criar', () => {
    it('cria PENDENTE com o usuário do token e agenda solicitacao.criada', async () => {
      const { servico, tx, eventos } = criarServico()

      await expect(servico.criar(TIME, EU)).resolves.toEqual({
        id: SOLICITACAO,
        timeId: TIME,
        status: 'PENDENTE',
        criadaEm: CRIADA_EM.toISOString(),
        canceladaEm: null,
      })
      expect(tx.solicitacaoEntrada.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { atleticaId: ATUAL, timeId: TIME, usuarioId: EU.id } }),
      )
      expect(eventos.emitirAposCommit).toHaveBeenCalledTimes(1)
      expect(eventos.emitirAposCommit).toHaveBeenCalledWith('solicitacao.criada', {
        atleticaId: ATUAL,
        solicitacaoId: SOLICITACAO,
        timeId: TIME,
        autorId: EU.id,
      })
    })

    it.each<[string, Cenario, string]>([
      ['inexistente ou de outra atlética', { time: null }, 'NOT_FOUND'],
      ['adversário', { time: { usaAplicativo: false, ativo: false } }, 'TIME_ADVERSARIO'],
      ['inativo', { time: { ativo: false }, membro: true }, 'TIME_INATIVO'],
      ['modalidade inativa', { time: { modalidadeAtiva: false } }, 'TIME_INATIVO'],
      ['já membro', { membro: true, pendente: true }, 'JA_E_MEMBRO'],
      ['já tem pendente', { pendente: true }, 'SOLICITACAO_PENDENTE'],
    ])('%s → %s, sem gravar nem emitir', async (_, cenario, codigo) => {
      const { servico, tx, eventos } = criarServico(cenario)
      await expect(codigoDaRejeicao(servico.criar(TIME, EU))).resolves.toBe(codigo)
      expect(tx.solicitacaoEntrada.create).not.toHaveBeenCalled()
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })

    it('P2002 no índice parcial (corrida) → SOLICITACAO_PENDENTE', async () => {
      const { servico, transacao } = criarServico()
      transacao.executar.mockRejectedValueOnce(erroPrisma('P2002'))
      await expect(codigoDaRejeicao(servico.criar(TIME, EU))).resolves.toBe('SOLICITACAO_PENDENTE')
    })

    it('outros erros do Prisma passam adiante', async () => {
      const { servico, transacao } = criarServico()
      transacao.executar.mockRejectedValueOnce(erroPrisma('P2003'))
      await expect(servico.criar(TIME, EU)).rejects.toMatchObject({ code: 'P2003' })
    })

    it('nova solicitação após REJEITADA ou CANCELADA: só PENDENTE bloqueia (RN29)', async () => {
      const { servico, tx } = criarServico()
      await servico.criar(TIME, EU)
      expect(tx.solicitacaoEntrada.count).toHaveBeenCalledWith({
        where: { timeId: TIME, usuarioId: EU.id, status: 'PENDENTE' },
      })
    })

    it('membro ativo é o vínculo sem saidaEm', async () => {
      const { servico, tx } = criarServico()
      await servico.criar(TIME, EU)
      expect(tx.membroTime.count).toHaveBeenCalledWith({
        where: { timeId: TIME, usuarioId: EU.id, saidaEm: null },
      })
    })
  })

  describe('cancelar', () => {
    it('dono e pendente: transição condicional com canceladaEm', async () => {
      const { servico, db } = criarServico({ atual: 'CANCELADA' })

      await expect(servico.cancelar(SOLICITACAO, EU.id)).resolves.toMatchObject({
        status: 'CANCELADA',
        canceladaEm: CANCELADA_EM.toISOString(),
      })
      expect(db.solicitacaoEntrada.updateMany).toHaveBeenCalledWith({
        where: { id: SOLICITACAO, usuarioId: EU.id, status: 'PENDENTE' },
        data: { status: 'CANCELADA', canceladaEm: expect.any(Date) as Date },
      })
    })

    it('já cancelada: 200 com o estado atual (idempotente)', async () => {
      const { servico, db } = criarServico({ atual: 'CANCELADA' })
      db.solicitacaoEntrada.updateMany.mockResolvedValueOnce({ count: 0 })
      await expect(servico.cancelar(SOLICITACAO, EU.id)).resolves.toMatchObject({
        status: 'CANCELADA',
      })
    })

    it.each<Status>(['APROVADA', 'REJEITADA'])('%s → SOLICITACAO_JA_AVALIADA', async (status) => {
      const { servico, db } = criarServico({ atual: status })
      db.solicitacaoEntrada.updateMany.mockResolvedValueOnce({ count: 0 })
      await expect(codigoDaRejeicao(servico.cancelar(SOLICITACAO, EU.id))).resolves.toBe(
        'SOLICITACAO_JA_AVALIADA',
      )
    })

    it('de outro usuário ou inexistente → NOT_FOUND', async () => {
      const { servico, db } = criarServico({ atual: null })
      db.solicitacaoEntrada.updateMany.mockResolvedValueOnce({ count: 0 })
      await expect(codigoDaRejeicao(servico.cancelar(SOLICITACAO, EU.id))).resolves.toBe(
        'NOT_FOUND',
      )
      expect(db.solicitacaoEntrada.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SOLICITACAO, usuarioId: EU.id } }),
      )
    })
  })

  describe('minhaSituacao', () => {
    const proprio = { id: TIME, atletica: { id: ATUAL, nome: 'A', sigla: null, propria: true } }

    it('membro', async () => {
      const { servico } = criarServico({ membro: true })
      await expect(servico.minhaSituacao(proprio, EU.id)).resolves.toEqual({
        membro: true,
        solicitacaoPendente: null,
      })
    })

    it('pendente', async () => {
      const { servico } = criarServico({ pendente: true })
      await expect(servico.minhaSituacao(proprio, EU.id)).resolves.toEqual({
        membro: false,
        solicitacaoPendente: { id: SOLICITACAO, criadaEm: CRIADA_EM.toISOString() },
      })
    })

    it('nenhuma', async () => {
      const { servico } = criarServico()
      await expect(servico.minhaSituacao(proprio, EU.id)).resolves.toEqual({
        membro: false,
        solicitacaoPendente: null,
      })
    })

    it('adversário → null, sem consultar', async () => {
      const { servico, db } = criarServico()
      const adversario = { ...proprio, atletica: { ...proprio.atletica, propria: false } }
      await expect(servico.minhaSituacao(adversario, EU.id)).resolves.toBeNull()
      expect(db.membroTime.count).not.toHaveBeenCalled()
    })
  })
})
