import type { RegistrarResultado } from '@atletica/shared'
import { codigoDaRejeicao } from '../../../test/suporte/codigo-do-erro'
import type { TransacaoService } from '../../infra/eventos/apos-commit'
import type { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import type { EventosStatusService } from './eventos-status.service'
import { ResultadoService } from './resultado.service'

const ATUAL = 'a1a1a1a1-0000-4000-8000-000000000001'
const ID = 'e1e1e1e1-0000-4000-8000-000000000001'
const TIME = 'b1b1b1b1-0000-4000-8000-000000000001'
const ADVERSARIO = 'b2b2b2b2-0000-4000-8000-000000000002'
const AUTOR = { id: 'd1d1d1d1-0000-4000-8000-000000000001', atleticaId: ATUAL }
const INICIO = new Date('2026-10-10T22:00:00.000Z')

function jogo(dados: Record<string, unknown> = {}) {
  return {
    id: ID,
    tipo: 'JOGO',
    status: 'FINALIZADO',
    inicio: INICIO,
    local: 'Ginásio',
    observacoes: null,
    serieId: null,
    timeId: TIME,
    timeAdversarioId: ADVERSARIO,
    placarTime: null,
    placarAdversario: null,
    resultado: null,
    criadoEm: INICIO,
    atualizadoEm: INICIO,
    time: { id: TIME, nome: 'Vôlei', modalidade: { id: 'm', nome: 'Vôlei', icone: 'volleyball' } },
    timeAdversario: {
      id: ADVERSARIO,
      nome: 'Rival',
      atletica: { id: 'x', nome: 'R', sigla: null },
    },
    ...dados,
  }
}

interface Cenario {
  atual?: ReturnType<typeof jogo> | null
  atualizados?: number
}

function criarServico(cenario: Cenario = {}) {
  const atual = cenario.atual === undefined ? jogo() : cenario.atual
  let gravado: Record<string, unknown> = {}
  const tx = {
    evento: {
      findFirst: jest.fn(() =>
        Promise.resolve(atual && { ...atual, status: 'FINALIZADO', ...gravado }),
      ),
      updateMany: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        gravado = data
        return Promise.resolve({ count: cenario.atualizados ?? 1 })
      }),
    },
  }
  tx.evento.findFirst.mockResolvedValueOnce(atual)
  const transacao = { executar: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) }
  const auditoria = { registrar: jest.fn() }
  const dominio = { emitirAposCommit: jest.fn() }
  const status = { trocar: jest.fn().mockResolvedValue(undefined) }
  const servico = new ResultadoService(
    transacao as unknown as TransacaoService,
    auditoria as unknown as AuditoriaService,
    dominio as unknown as EventosDominioService,
    status as unknown as EventosStatusService,
  )
  return { servico, tx, auditoria, dominio, status }
}

const placar = (placarTime: number, placarAdversario: number, finalizar?: boolean) =>
  ({ placarTime, placarAdversario, finalizar }) as RegistrarResultado

describe('ResultadoService.registrar', () => {
  it('primeiro registro: grava, audita RESULTADO_REGISTRADO e emite evento.resultadoRegistrado', async () => {
    const { servico, tx, auditoria, dominio, status } = criarServico()
    const dto = await servico.registrar(ID, placar(3, 1), AUTOR)

    expect(status.trocar).not.toHaveBeenCalled()
    expect(tx.evento.updateMany).toHaveBeenCalledWith({
      where: {
        id: ID,
        status: 'FINALIZADO',
        placarTime: null,
        placarAdversario: null,
        resultado: null,
      },
      data: { placarTime: 3, placarAdversario: 1, resultado: 'VITORIA' },
    })
    expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
      entidade: 'Evento',
      acao: 'RESULTADO_REGISTRADO',
      entidadeId: ID,
      dados: {
        antes: { placarTime: null, placarAdversario: null, resultado: null },
        depois: { placarTime: 3, placarAdversario: 1, resultado: 'VITORIA' },
      },
    })
    expect(dominio.emitirAposCommit).toHaveBeenCalledWith('evento.resultadoRegistrado', {
      atleticaId: ATUAL,
      eventoId: ID,
      autorId: AUTOR.id,
    })
    expect(dto).toMatchObject({ status: 'FINALIZADO', placarTime: 3, resultado: 'VITORIA' })
  })

  it.each([
    [1, 1, 'EMPATE'],
    [0, 2, 'DERROTA'],
  ])('%i × %i → %s', async (time, adversario, resultado) => {
    const { servico } = criarServico()
    await expect(servico.registrar(ID, placar(time, adversario), AUTOR)).resolves.toMatchObject({
      resultado,
    })
  })

  it('correção: audita RESULTADO_CORRIGIDO com antes/depois e não emite evento', async () => {
    const atual = jogo({ placarTime: 3, placarAdversario: 1, resultado: 'VITORIA' })
    const { servico, tx, auditoria, dominio } = criarServico({ atual })
    await servico.registrar(ID, placar(2, 2), AUTOR)

    expect(tx.evento.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { placarTime: 3, placarAdversario: 1, resultado: 'VITORIA' },
    })
    expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
      entidade: 'Evento',
      acao: 'RESULTADO_CORRIGIDO',
      entidadeId: ID,
      dados: {
        antes: { placarTime: 3, placarAdversario: 1, resultado: 'VITORIA' },
        depois: { placarTime: 2, placarAdversario: 2, resultado: 'EMPATE' },
      },
    })
    expect(dominio.emitirAposCommit).not.toHaveBeenCalled()
  })

  it('correção só com campos alterados na auditoria', async () => {
    const atual = jogo({ placarTime: 3, placarAdversario: 1, resultado: 'VITORIA' })
    const { servico, auditoria } = criarServico({ atual })
    await servico.registrar(ID, placar(4, 1), AUTOR)
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dados: { antes: { placarTime: 3 }, depois: { placarTime: 4 } } }),
    )
  })

  it('mesmo placar: no-op, sem gravação, auditoria nem evento', async () => {
    const atual = jogo({ placarTime: 3, placarAdversario: 1, resultado: 'VITORIA' })
    const { servico, tx, auditoria, dominio } = criarServico({ atual })
    await expect(servico.registrar(ID, placar(3, 1), AUTOR)).resolves.toMatchObject({
      placarTime: 3,
      resultado: 'VITORIA',
    })
    expect(tx.evento.updateMany).not.toHaveBeenCalled()
    expect(auditoria.registrar).not.toHaveBeenCalled()
    expect(dominio.emitirAposCommit).not.toHaveBeenCalled()
  })

  it.each(['AGENDADO', 'EM_ANDAMENTO'])(
    'finalizar a partir de %s: troca o status na mesma transação e registra',
    async (de) => {
      const { servico, tx, status, auditoria, dominio } = criarServico({
        atual: jogo({ status: de }),
      })
      const dto = await servico.registrar(ID, placar(3, 1, true), AUTOR)

      expect(status.trocar).toHaveBeenCalledWith(tx, ID, de, 'FINALIZADO')
      expect(auditoria.registrar).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ acao: 'RESULTADO_REGISTRADO' }),
      )
      expect(dominio.emitirAposCommit).toHaveBeenCalledTimes(2)
      expect(dominio.emitirAposCommit).toHaveBeenLastCalledWith(
        'evento.resultadoRegistrado',
        expect.anything(),
      )
      expect(dominio.emitirAposCommit).toHaveBeenNthCalledWith(1, 'evento.alterado', {
        atleticaId: ATUAL,
        eventoIds: [ID],
        timeId: TIME,
        campos: ['status'],
        autorId: AUTOR.id,
      })
      expect(dto).toMatchObject({ status: 'FINALIZADO', resultado: 'VITORIA' })
    },
  )

  it.each(['AGENDADO', 'EM_ANDAMENTO'])(
    'sem finalizar a partir de %s: 422 EVENTO_NAO_FINALIZADO',
    async (de) => {
      const { servico, status, tx } = criarServico({ atual: jogo({ status: de }) })
      expect(await codigoDaRejeicao(servico.registrar(ID, placar(3, 1), AUTOR))).toBe(
        'EVENTO_NAO_FINALIZADO',
      )
      expect(status.trocar).not.toHaveBeenCalled()
      expect(tx.evento.updateMany).not.toHaveBeenCalled()
    },
  )

  it.each([true, false])('CANCELADO (finalizar: %s): 422 EVENTO_CANCELADO', async (finalizar) => {
    const { servico, status } = criarServico({ atual: jogo({ status: 'CANCELADO' }) })
    expect(await codigoDaRejeicao(servico.registrar(ID, placar(3, 1, finalizar), AUTOR))).toBe(
      'EVENTO_CANCELADO',
    )
    expect(status.trocar).not.toHaveBeenCalled()
  })

  it('TREINO: 422 EVENTO_NAO_E_JOGO', async () => {
    const atual = jogo({ tipo: 'TREINO', timeAdversarioId: null, timeAdversario: null })
    const { servico } = criarServico({ atual })
    expect(await codigoDaRejeicao(servico.registrar(ID, placar(3, 1, true), AUTOR))).toBe(
      'EVENTO_NAO_E_JOGO',
    )
  })

  it('placar mudou entre a leitura e a gravação: 409 CONFLITO_STATUS sem auditoria', async () => {
    const { servico, auditoria, dominio } = criarServico({ atualizados: 0 })
    expect(await codigoDaRejeicao(servico.registrar(ID, placar(3, 1), AUTOR))).toBe(
      'CONFLITO_STATUS',
    )
    expect(auditoria.registrar).not.toHaveBeenCalled()
    expect(dominio.emitirAposCommit).not.toHaveBeenCalled()
  })

  it('inexistente: 404', async () => {
    const { servico } = criarServico({ atual: null })
    expect(await codigoDaRejeicao(servico.registrar(ID, placar(3, 1), AUTOR))).toBe('NOT_FOUND')
  })
})
