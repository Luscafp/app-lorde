import { StatusEvento, TRANSICOES_STATUS } from '@atletica/shared'
import { codigoDaRejeicao } from '../../../test/suporte/codigo-do-erro'
import type { TransacaoService } from '../../infra/eventos/apos-commit'
import type { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import { EventosStatusService } from './eventos-status.service'
import type { EventosService } from './eventos.service'

const ATUAL = 'a1a1a1a1-0000-4000-8000-000000000001'
const ID = 'e1e1e1e1-0000-4000-8000-000000000001'
const TIME = 'b1b1b1b1-0000-4000-8000-000000000001'
const AUTOR = { id: 'd1d1d1d1-0000-4000-8000-000000000001', atleticaId: ATUAL }

interface Cenario {
  status?: StatusEvento
  resultado?: string | null
  presencas?: number
  atualizados?: number
  cancelados?: string[]
  existe?: boolean
}

function criarServico(cenario: Cenario = {}) {
  const evento = {
    status: cenario.status ?? 'AGENDADO',
    timeId: TIME,
    resultado: cenario.resultado ?? null,
  }
  const tx = {
    evento: {
      findFirst: jest.fn().mockResolvedValue(cenario.existe === false ? null : evento),
      updateMany: jest.fn().mockResolvedValue({ count: cenario.atualizados ?? 1 }),
    },
    participacao: { count: jest.fn().mockResolvedValue(cenario.presencas ?? 0) },
  }
  const transacao = { executar: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) }
  const auditoria = { registrar: jest.fn() }
  const dominio = { emitirAposCommit: jest.fn() }
  const eventos = { cancelar: jest.fn().mockResolvedValue(cenario.cancelados ?? [ID]) }
  const servico = new EventosStatusService(
    transacao as unknown as TransacaoService,
    auditoria as unknown as AuditoriaService,
    dominio as unknown as EventosDominioService,
    eventos as unknown as EventosService,
  )
  return { servico, tx, auditoria, dominio, eventos }
}

const todos = Object.values(StatusEvento)
const pares = todos.flatMap((de) => todos.map((para) => [de, para] as const))

describe('EventosStatusService.alterar', () => {
  describe('máquina de estados — 16 combinações (sem dados dependentes)', () => {
    it.each(pares)('%s → %s', async (de, para) => {
      const { servico, auditoria, eventos, tx } = criarServico({ status: de })
      const alterar = servico.alterar(ID, para, AUTOR)

      if (de === para) {
        await expect(alterar).resolves.toEqual({ id: ID, status: para, statusAnterior: de })
        expect(auditoria.registrar).not.toHaveBeenCalled()
        expect(tx.evento.updateMany).not.toHaveBeenCalled()
      } else if (TRANSICOES_STATUS[de].includes(para)) {
        await expect(alterar).resolves.toEqual({ id: ID, status: para, statusAnterior: de })
      } else {
        expect(await codigoDaRejeicao(alterar)).toBe('TRANSICAO_INVALIDA')
        expect(tx.evento.updateMany).not.toHaveBeenCalled()
        expect(eventos.cancelar).not.toHaveBeenCalled()
      }
    })
  })

  it('transição simples: update condicional, auditoria e evento.alterado com campos ["status"]', async () => {
    const { servico, tx, auditoria, dominio } = criarServico({ status: 'AGENDADO' })
    await servico.alterar(ID, 'EM_ANDAMENTO', AUTOR)

    expect(tx.evento.updateMany).toHaveBeenCalledWith({
      where: { id: ID, status: 'AGENDADO' },
      data: { status: 'EM_ANDAMENTO' },
    })
    expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
      entidade: 'Evento',
      acao: 'EVENTO_STATUS_ALTERADO',
      entidadeId: ID,
      dados: { antes: { status: 'AGENDADO' }, depois: { status: 'EM_ANDAMENTO' } },
    })
    expect(dominio.emitirAposCommit).toHaveBeenCalledWith('evento.alterado', {
      atleticaId: ATUAL,
      eventoIds: [ID],
      timeId: TIME,
      campos: ['status'],
      autorId: AUTOR.id,
    })
  })

  it('TRANSICAO_INVALIDA traz de → para nos details', async () => {
    const { servico } = criarServico({ status: 'CANCELADO' })
    await expect(servico.alterar(ID, 'AGENDADO', AUTOR)).rejects.toMatchObject({
      statusCode: 422,
      code: 'TRANSICAO_INVALIDA',
      details: [{ field: 'status', message: 'CANCELADO → AGENDADO não é permitido' }],
    })
  })

  it('FINALIZADO → EM_ANDAMENTO com resultado: TRANSICAO_INVALIDA', async () => {
    const { servico, tx } = criarServico({ status: 'FINALIZADO', resultado: 'VITORIA' })
    expect(await codigoDaRejeicao(servico.alterar(ID, 'EM_ANDAMENTO', AUTOR))).toBe(
      'TRANSICAO_INVALIDA',
    )
    expect(tx.evento.updateMany).not.toHaveBeenCalled()
  })

  it('EM_ANDAMENTO → AGENDADO com presença registrada: TRANSICAO_INVALIDA', async () => {
    const { servico, tx } = criarServico({ status: 'EM_ANDAMENTO', presencas: 2 })
    expect(await codigoDaRejeicao(servico.alterar(ID, 'AGENDADO', AUTOR))).toBe(
      'TRANSICAO_INVALIDA',
    )
    expect(tx.participacao.count).toHaveBeenCalledWith({
      where: { eventoId: ID, presente: { not: null } },
    })
    expect(tx.evento.updateMany).not.toHaveBeenCalled()
  })

  it('a guarda de presença só é consultada no retorno para AGENDADO', async () => {
    const { servico, tx } = criarServico({ status: 'EM_ANDAMENTO' })
    await servico.alterar(ID, 'FINALIZADO', AUTOR)
    expect(tx.participacao.count).not.toHaveBeenCalled()
  })

  it('status mudou entre a leitura e a gravação: 409 CONFLITO_STATUS, sem auditoria nem evento', async () => {
    const { servico, auditoria, dominio } = criarServico({ status: 'AGENDADO', atualizados: 0 })
    expect(await codigoDaRejeicao(servico.alterar(ID, 'FINALIZADO', AUTOR))).toBe('CONFLITO_STATUS')
    expect(auditoria.registrar).not.toHaveBeenCalled()
    expect(dominio.emitirAposCommit).not.toHaveBeenCalled()
  })

  it('CANCELADO delega a EventosService.cancelar com o status lido e emite evento.cancelado', async () => {
    const { servico, tx, eventos, auditoria, dominio } = criarServico({ status: 'EM_ANDAMENTO' })
    await expect(servico.alterar(ID, 'CANCELADO', AUTOR)).resolves.toEqual({
      id: ID,
      status: 'CANCELADO',
      statusAnterior: 'EM_ANDAMENTO',
    })
    expect(eventos.cancelar).toHaveBeenCalledWith(tx, [ID], AUTOR, 'EM_ANDAMENTO')
    expect(tx.evento.updateMany).not.toHaveBeenCalled()
    expect(auditoria.registrar).not.toHaveBeenCalled()
    expect(dominio.emitirAposCommit).toHaveBeenCalledWith('evento.cancelado', {
      atleticaId: ATUAL,
      eventoIds: [ID],
      timeId: TIME,
      autorId: AUTOR.id,
    })
  })

  it('cancelamento sem linha cancelada: 409 CONFLITO_STATUS', async () => {
    const { servico, dominio } = criarServico({ status: 'AGENDADO', cancelados: [] })
    expect(await codigoDaRejeicao(servico.alterar(ID, 'CANCELADO', AUTOR))).toBe('CONFLITO_STATUS')
    expect(dominio.emitirAposCommit).not.toHaveBeenCalled()
  })

  it('evento inexistente, excluído ou de outra atlética: 404', async () => {
    const { servico } = criarServico({ existe: false })
    expect(await codigoDaRejeicao(servico.alterar(ID, 'FINALIZADO', AUTOR))).toBe('NOT_FOUND')
  })
})

describe('EventosStatusService.trocar', () => {
  it('não emite evento de domínio (quem chama decide)', async () => {
    const { servico, tx, dominio, auditoria } = criarServico()
    await servico.trocar(tx as never, ID, 'EM_ANDAMENTO', 'FINALIZADO')
    expect(auditoria.registrar).toHaveBeenCalledTimes(1)
    expect(dominio.emitirAposCommit).not.toHaveBeenCalled()
  })
})
