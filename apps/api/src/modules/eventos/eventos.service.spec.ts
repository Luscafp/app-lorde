import type { CriarEvento, EditarEvento } from '@atletica/shared'
import { codigoDaRejeicao } from '../../../test/suporte/codigo-do-erro'
import { ErroNegocio } from '../../common/erros/erro-negocio'
import type { TransacaoService } from '../../infra/eventos/apos-commit'
import type { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import { erroModalidadesDiferentes } from './erros'
import { EventosService } from './eventos.service'

const ATUAL = 'a1a1a1a1-0000-4000-8000-000000000001'
const ID = 'e1e1e1e1-0000-4000-8000-000000000001'
const TIME = 'b1b1b1b1-0000-4000-8000-000000000001'
const OUTRO_TIME = 'b3b3b3b3-0000-4000-8000-000000000003'
const ADVERSARIO = 'b2b2b2b2-0000-4000-8000-000000000002'
const VOLEI = 'c1c1c1c1-0000-4000-8000-000000000001'
const AUTOR = { id: 'd1d1d1d1-0000-4000-8000-000000000001', atleticaId: ATUAL }
const INICIO = new Date('2026-10-10T22:00:00.000Z')
const NOVO_INICIO = '2026-10-11T22:00:00.000Z'

function linha(dados: Record<string, unknown> = {}) {
  return {
    id: ID,
    tipo: 'TREINO',
    status: 'AGENDADO',
    inicio: INICIO,
    local: 'Ginásio',
    observacoes: null,
    serieId: null,
    timeId: TIME,
    timeAdversarioId: null,
    placarTime: null,
    placarAdversario: null,
    resultado: null,
    criadoEm: INICIO,
    atualizadoEm: INICIO,
    time: {
      id: TIME,
      nome: 'Vôlei',
      modalidade: { id: VOLEI, nome: 'Vôlei', icone: 'volleyball' },
    },
    timeAdversario: null,
    ...dados,
  }
}

const jogo = (dados: Record<string, unknown> = {}) =>
  linha({
    tipo: 'JOGO',
    timeAdversarioId: ADVERSARIO,
    timeAdversario: {
      id: ADVERSARIO,
      nome: 'Rival',
      atletica: { id: 'x', nome: 'Rival', sigla: null },
    },
    ...dados,
  })

interface Cenario {
  atual?: ReturnType<typeof linha> | null
  participacoes?: number
  cancelaveis?: { id: string; status: string }[]
}

function criarServico(cenario: Cenario = {}) {
  const atual = cenario.atual === undefined ? linha() : cenario.atual
  const cancelaveis = cenario.cancelaveis ?? [{ id: ID, status: 'AGENDADO' }]
  const tx = {
    evento: {
      findFirst: jest.fn().mockResolvedValue(atual),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(linha({ ...data })),
      ),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...atual, ...data }),
      ),
      findMany: jest.fn().mockResolvedValue(cancelaveis),
      updateManyAndReturn: jest.fn().mockResolvedValue(cancelaveis.map(({ id }) => ({ id }))),
    },
    participacao: { count: jest.fn().mockResolvedValue(cenario.participacoes ?? 0) },
  }
  const transacao = { executar: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) }
  const auditoria = { registrar: jest.fn(), registrarVarios: jest.fn() }
  const eventos = { emitirAposCommit: jest.fn() }
  const validator = {
    validarTime: jest.fn((_tx: unknown, id: string) =>
      Promise.resolve({ id, modalidadeId: VOLEI }),
    ),
    validarAdversario: jest.fn().mockResolvedValue(undefined),
  }
  const servico = new EventosService(
    transacao as unknown as TransacaoService,
    auditoria as unknown as AuditoriaService,
    eventos as unknown as EventosDominioService,
    validator,
  )
  return { servico, tx, auditoria, eventos, validator }
}

describe('EventosService', () => {
  describe('criar', () => {
    const treino: CriarEvento = {
      tipo: 'TREINO',
      timeId: TIME,
      inicio: INICIO.toISOString(),
      local: 'Ginásio',
    }

    it('TREINO grava sem adversário, com autor, audita e emite evento.criado', async () => {
      const { servico, tx, auditoria, eventos, validator } = criarServico()
      const dto = await servico.criar(treino, AUTOR)

      expect(validator.validarAdversario).toHaveBeenCalledWith(tx, null, expect.anything(), ATUAL)
      expect(tx.evento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            atleticaId: ATUAL,
            timeAdversarioId: null,
            observacoes: null,
            criadoPorId: AUTOR.id,
            inicio: INICIO,
          }) as unknown,
        }),
      )
      expect(dto).toMatchObject({
        tipo: 'TREINO',
        inicio: INICIO.toISOString(),
        modalidade: { id: VOLEI },
        time: { id: TIME, nome: 'Vôlei' },
      })
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'Evento',
        acao: 'EVENTO_CRIADO',
        entidadeId: ID,
        dados: {
          antes: null,
          depois: expect.objectContaining({ tipo: 'TREINO', timeId: TIME }) as unknown,
        },
      })
      expect(eventos.emitirAposCommit).toHaveBeenCalledWith('evento.criado', {
        atleticaId: ATUAL,
        eventoId: ID,
        timeId: TIME,
        autorId: AUTOR.id,
      })
    })

    it('JOGO valida o adversário contra o time (RN11)', async () => {
      const { servico, validator } = criarServico()
      await servico.criar({ ...treino, tipo: 'JOGO', timeAdversarioId: ADVERSARIO }, AUTOR)
      expect(validator.validarAdversario).toHaveBeenCalledWith(
        expect.anything(),
        ADVERSARIO,
        { id: TIME, modalidadeId: VOLEI },
        ATUAL,
      )
    })

    it('adversário inválido não grava nem emite', async () => {
      const { servico, tx, eventos, validator } = criarServico()
      validator.validarAdversario.mockRejectedValue(erroModalidadesDiferentes())
      await expect(
        codigoDaRejeicao(
          servico.criar({ ...treino, tipo: 'JOGO', timeAdversarioId: ADVERSARIO }, AUTOR),
        ),
      ).resolves.toBe('MODALIDADES_DIFERENTES')
      expect(tx.evento.create).not.toHaveBeenCalled()
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })
  })

  describe('atualizar', () => {
    it.each<[string, EditarEvento, string[] | null]>([
      ['só inicio', { inicio: NOVO_INICIO }, ['inicio']],
      ['só local', { local: 'Quadra' }, ['local']],
      ['inicio e local', { inicio: NOVO_INICIO, local: 'Quadra' }, ['inicio', 'local']],
      ['só observações', { observacoes: 'Levar água' }, null],
      ['inicio igual ao atual', { inicio: '2026-10-10T22:00:00+00:00', local: 'Ginásio' }, null],
    ])('%s → campos %j', async (_caso, entrada, campos) => {
      const { servico, eventos } = criarServico()
      await servico.atualizar(ID, entrada, AUTOR)
      if (campos) {
        expect(eventos.emitirAposCommit).toHaveBeenCalledWith('evento.alterado', {
          atleticaId: ATUAL,
          eventoIds: [ID],
          timeId: TIME,
          campos,
          autorId: AUTOR.id,
        })
      } else {
        expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
      }
    })

    it('audita só os campos alterados', async () => {
      const { servico, tx, auditoria } = criarServico()
      await servico.atualizar(ID, { local: 'Quadra', observacoes: null }, AUTOR)
      expect(tx.evento.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ID }, data: { local: 'Quadra' } }),
      )
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'Evento',
        acao: 'EVENTO_ALTERADO',
        entidadeId: ID,
        dados: { antes: { local: 'Ginásio' }, depois: { local: 'Quadra' } },
      })
    })

    it('sem mudança não grava, não audita e não emite', async () => {
      const { servico, tx, auditoria, eventos } = criarServico()
      const dto = await servico.atualizar(ID, { local: 'Ginásio' }, AUTOR)
      expect(dto.local).toBe('Ginásio')
      expect(tx.evento.update).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })

    it.each<[string, Record<string, unknown>, EditarEvento, string | null]>([
      ['AGENDADO edita local', {}, { local: 'Quadra' }, null],
      ['EM_ANDAMENTO edita local', { status: 'EM_ANDAMENTO' }, { local: 'Quadra' }, null],
      ['FINALIZADO edita observações', { status: 'FINALIZADO' }, { observacoes: 'Ok' }, null],
      [
        'FINALIZADO edita local',
        { status: 'FINALIZADO' },
        { local: 'Quadra' },
        'EVENTO_FINALIZADO',
      ],
      ['CANCELADO', { status: 'CANCELADO' }, { observacoes: 'Ok' }, 'EVENTO_CANCELADO'],
      ['TREINO com adversário', {}, { timeAdversarioId: ADVERSARIO }, 'VALIDATION_ERROR'],
      [
        'TREINO cancelado com adversário',
        { status: 'CANCELADO' },
        { timeAdversarioId: ADVERSARIO },
        'VALIDATION_ERROR',
      ],
    ])('regras por status: %s', async (_caso, dados, entrada, codigo) => {
      const { servico } = criarServico({ atual: linha(dados) })
      const promessa = servico.atualizar(ID, entrada, AUTOR)
      if (codigo) await expect(codigoDaRejeicao(promessa)).resolves.toBe(codigo)
      else await expect(promessa).resolves.toBeDefined()
    })

    it('inexistente ou excluído → NOT_FOUND', async () => {
      const { servico } = criarServico({ atual: null })
      await expect(
        codigoDaRejeicao(servico.atualizar(ID, { local: 'Quadra' }, AUTOR)),
      ).resolves.toBe('NOT_FOUND')
    })

    it('troca de timeId com participação → EVENTO_COM_PARTICIPACOES', async () => {
      const { servico, tx } = criarServico({ participacoes: 1 })
      await expect(
        codigoDaRejeicao(servico.atualizar(ID, { timeId: OUTRO_TIME }, AUTOR)),
      ).resolves.toBe('EVENTO_COM_PARTICIPACOES')
      expect(tx.evento.update).not.toHaveBeenCalled()
    })

    it('troca de timeId sem participação valida o novo time e o adversário atual', async () => {
      const { servico, validator } = criarServico({ atual: jogo() })
      await servico.atualizar(ID, { timeId: OUTRO_TIME }, AUTOR)
      expect(validator.validarTime).toHaveBeenCalledWith(expect.anything(), OUTRO_TIME, ATUAL)
      expect(validator.validarAdversario).toHaveBeenCalledWith(
        expect.anything(),
        ADVERSARIO,
        { id: OUTRO_TIME, modalidadeId: VOLEI },
        ATUAL,
      )
    })

    it('troca só do adversário usa o time atual sem revalidá-lo', async () => {
      const novo = 'b4b4b4b4-0000-4000-8000-000000000004'
      const { servico, validator, tx } = criarServico({ atual: jogo() })
      await servico.atualizar(ID, { timeAdversarioId: novo }, AUTOR)
      expect(validator.validarTime).not.toHaveBeenCalled()
      expect(tx.participacao.count).not.toHaveBeenCalled()
      expect(validator.validarAdversario).toHaveBeenCalledWith(
        expect.anything(),
        novo,
        { id: TIME, modalidadeId: VOLEI },
        ATUAL,
      )
    })
  })

  describe('cancelar', () => {
    it('cancela os canceláveis e audita um por evento com o status anterior', async () => {
      const outro = 'e2e2e2e2-0000-4000-8000-000000000002'
      const { servico, tx, auditoria } = criarServico({
        cancelaveis: [
          { id: ID, status: 'AGENDADO' },
          { id: outro, status: 'EM_ANDAMENTO' },
        ],
      })
      const ids = await servico.cancelar(tx as never, [ID, outro], { id: AUTOR.id })

      expect(ids).toEqual([ID, outro])
      expect(tx.evento.updateManyAndReturn).toHaveBeenCalledWith({
        where: {
          id: { in: [ID, outro] },
          status: { in: ['AGENDADO', 'EM_ANDAMENTO'] },
          excluidoEm: null,
        },
        data: { status: 'CANCELADO' },
        select: { id: true },
      })
      expect(auditoria.registrarVarios).toHaveBeenCalledWith(tx, [
        expect.objectContaining({
          entidadeId: ID,
          acao: 'EVENTO_CANCELADO',
          usuarioId: AUTOR.id,
          dados: { antes: { status: 'AGENDADO' }, depois: { status: 'CANCELADO' } },
        }),
        expect.objectContaining({
          entidadeId: outro,
          dados: { antes: { status: 'EM_ANDAMENTO' }, depois: { status: 'CANCELADO' } },
        }),
      ])
    })

    it('cancelarPorId emite evento.cancelado com os ids', async () => {
      const { servico, eventos } = criarServico()
      await expect(servico.cancelarPorId(ID, AUTOR)).resolves.toEqual({
        eventoIds: [ID],
        status: 'CANCELADO',
      })
      expect(eventos.emitirAposCommit).toHaveBeenCalledWith('evento.cancelado', {
        atleticaId: ATUAL,
        eventoIds: [ID],
        timeId: TIME,
        autorId: AUTOR.id,
      })
    })

    it.each([
      ['FINALIZADO', 'EVENTO_FINALIZADO'],
      ['CANCELADO', 'EVENTO_JA_CANCELADO'],
    ])('%s → %s sem emitir', async (status, codigo) => {
      const { servico, eventos } = criarServico({ atual: linha({ status }), cancelaveis: [] })
      await expect(codigoDaRejeicao(servico.cancelarPorId(ID, AUTOR))).resolves.toBe(codigo)
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })
  })

  describe('excluir', () => {
    it('sem dependências preenche excluidoEm e audita o snapshot', async () => {
      const { servico, tx, auditoria, eventos } = criarServico()
      await servico.excluir(ID)
      expect(tx.evento.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { excluidoEm: expect.any(Date) as Date },
      })
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'Evento',
        acao: 'EVENTO_EXCLUIDO',
        entidadeId: ID,
        dados: { antes: expect.objectContaining({ status: 'AGENDADO' }) as unknown, depois: null },
      })
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })

    it.each<[string, Cenario, { field: string; message: string }[]]>([
      ['um "Não vou"', { participacoes: 1 }, [{ field: 'participacoes', message: '1 resposta' }]],
      [
        'resultado e respostas',
        {
          participacoes: 3,
          atual: jogo({
            status: 'FINALIZADO',
            placarTime: 1,
            placarAdversario: 0,
            resultado: 'VITORIA',
          }),
        },
        [
          { field: 'participacoes', message: '3 respostas' },
          { field: 'resultado', message: 'Resultado registrado.' },
        ],
      ],
    ])('com %s → EVENTO_COM_DEPENDENCIAS', async (_caso, cenario, details) => {
      const { servico, tx } = criarServico(cenario)
      const erro = await servico.excluir(ID).catch((e: unknown) => e)
      expect(erro).toBeInstanceOf(ErroNegocio)
      expect(erro).toMatchObject({ code: 'EVENTO_COM_DEPENDENCIAS', details })
      expect(tx.evento.update).not.toHaveBeenCalled()
    })
  })
})
