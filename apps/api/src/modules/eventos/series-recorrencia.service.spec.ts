import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { CriarSerie, EditarSeguintes } from '@atletica/shared'
import { codigoDaRejeicao } from '../../../test/suporte/codigo-do-erro'
import type { TransacaoService } from '../../infra/eventos/apos-commit'
import type { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { naoExcluido } from '../../infra/prisma/nao-excluido'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import type { EventosService } from './eventos.service'
import { SeriesRecorrenciaService } from './series-recorrencia.service'

const ATUAL = 'a1a1a1a1-0000-4000-8000-000000000001'
const TIME = 'b1b1b1b1-0000-4000-8000-000000000001'
const SERIE = 'c1c1c1c1-0000-4000-8000-000000000001'
const NOVA_SERIE = 'c2c2c2c2-0000-4000-8000-000000000002'
const AUTOR = { id: 'd1d1d1d1-0000-4000-8000-000000000001', atleticaId: ATUAL }
const AGORA = new Date('2026-10-01T12:00:00.000Z')

const idOcorrencia = (n: number) => `e1e1e1e1-0000-4000-8000-${String(n).padStart(12, '0')}`

/** Segundas a partir de 05/10/2026 às 18:30 locais (21:30Z). */
function ocorrencia(n: number, dados: Record<string, unknown> = {}) {
  const inicio = new Date(Date.UTC(2026, 9, 5 + 7 * (n - 1), 21, 30))
  return {
    id: idOcorrencia(n),
    tipo: 'TREINO',
    status: 'AGENDADO',
    inicio,
    local: 'Quadra 1',
    observacoes: null,
    serieId: SERIE,
    timeId: TIME,
    timeAdversarioId: null,
    placarTime: null,
    placarAdversario: null,
    resultado: null,
    criadoEm: AGORA,
    atualizadoEm: AGORA,
    time: { id: TIME, nome: 'Vôlei', modalidade: { id: 'm', nome: 'Vôlei', icone: 'volleyball' } },
    timeAdversario: null,
    ...dados,
  }
}

const serie = (dados: Record<string, unknown> = {}) => ({
  id: SERIE,
  timeId: TIME,
  diasSemana: [1],
  horario: '18:30',
  dataInicio: new Date('2026-10-05T00:00:00.000Z'),
  dataFim: new Date('2026-12-07T00:00:00.000Z'),
  local: 'Quadra 1',
  observacoes: null,
  canceladaEm: null,
  ...dados,
})

interface Cenario {
  alvo?: ReturnType<typeof ocorrencia>
  seguintes?: ReturnType<typeof ocorrencia>[]
  anteriores?: number
  agendadosRestantes?: number
  cancelados?: string[]
}

function criarServico(cenario: Cenario = {}) {
  const alvo = cenario.alvo ?? ocorrencia(4)
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    evento: {
      findFirst: jest.fn().mockResolvedValue(alvo),
      findMany: jest.fn().mockResolvedValue(cenario.seguintes ?? []),
      count: jest.fn(({ where }: { where: { inicio?: unknown } }) =>
        Promise.resolve(
          where.inicio ? (cenario.anteriores ?? 0) : (cenario.agendadosRestantes ?? 0),
        ),
      ),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      createManyAndReturn: jest.fn(({ data }: { data: { inicio: Date }[] }) =>
        Promise.resolve(
          [...data].reverse().map(({ inicio }, i) => ({ id: idOcorrencia(i + 1), inicio })),
        ),
      ),
    },
    serieRecorrencia: {
      create: jest.fn(
        ({ data, select }: { data: Record<string, unknown>; select: Record<string, unknown> }) =>
          Promise.resolve({ ...data, id: select.dataFim ? SERIE : NOVA_SERIE }),
      ),
      findUniqueOrThrow: jest.fn().mockResolvedValue(serie()),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  }
  const transacao = { executar: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) }
  const auditoria = { registrar: jest.fn(), registrarVarios: jest.fn() }
  const dominio = { emitirAposCommit: jest.fn() }
  const validator = {
    validarTime: jest.fn().mockResolvedValue({ id: TIME, modalidadeId: 'm' }),
    validarAdversario: jest.fn(),
  }
  const eventos = {
    cancelar: jest.fn((_tx: unknown, ids: string[]) => Promise.resolve(cenario.cancelados ?? ids)),
  }
  const servico = new SeriesRecorrenciaService(
    transacao as unknown as TransacaoService,
    auditoria as unknown as AuditoriaService,
    dominio as unknown as EventosDominioService,
    validator,
    eventos as unknown as EventosService,
  )
  return { servico, tx, auditoria, dominio, validator, eventos }
}

const acoes = (auditoria: { registrar: jest.Mock }) =>
  auditoria.registrar.mock.calls.map(([, entrada]: [unknown, { acao: string }]) => entrada.acao)

describe('SeriesRecorrenciaService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: AGORA })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('criar', () => {
    const entrada: CriarSerie = {
      tipo: 'TREINO',
      timeId: TIME,
      local: 'Quadra do CCET',
      observacoes: 'Trazer colete',
      recorrencia: {
        dataInicio: '2026-10-05',
        horario: '18:30',
        diasSemana: [1, 3],
        dataFim: '2027-04-05',
      },
    }

    it('grava série e 53 ocorrências, audita uma vez e emite um evento.criado', async () => {
      const { servico, tx, auditoria, dominio } = criarServico()
      const dto = await servico.criar(entrada, AUTOR)

      expect(tx.serieRecorrencia.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            atleticaId: ATUAL,
            timeId: TIME,
            diasSemana: [1, 3],
            horario: '18:30',
            dataInicio: new Date('2026-10-05T00:00:00.000Z'),
            dataFim: new Date('2027-04-05T00:00:00.000Z'),
            local: 'Quadra do CCET',
            observacoes: 'Trazer colete',
            criadoPorId: AUTOR.id,
          }) as object,
        }),
      )
      const [{ data }] = tx.evento.createManyAndReturn.mock.calls[0] as [
        { data: Record<string, unknown>[] },
      ]
      expect(data).toHaveLength(53)
      expect(data[0]).toEqual({
        atleticaId: ATUAL,
        tipo: 'TREINO',
        timeId: TIME,
        serieId: SERIE,
        inicio: new Date('2026-10-05T21:30:00.000Z'),
        local: 'Quadra do CCET',
        observacoes: 'Trazer colete',
        criadoPorId: AUTOR.id,
      })

      expect(dto).toMatchObject({
        serie: { id: SERIE, dataInicio: '2026-10-05', dataFim: '2027-04-05', diasSemana: [1, 3] },
        totalOcorrencias: 53,
        primeiraOcorrencia: { inicio: '2026-10-05T21:30:00.000Z' },
        ultimaOcorrencia: { inicio: '2027-04-05T21:30:00.000Z' },
      })
      expect(auditoria.registrar).toHaveBeenCalledTimes(1)
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'SerieRecorrencia',
        acao: 'SERIE_CRIADA',
        entidadeId: SERIE,
        dados: {
          antes: null,
          depois: expect.objectContaining({ dataInicio: '2026-10-05', horario: '18:30' }) as object,
          contexto: { totalOcorrencias: 53 },
        },
      })
      expect(dominio.emitirAposCommit).toHaveBeenCalledTimes(1)
      expect(dominio.emitirAposCommit).toHaveBeenCalledWith('evento.criado', {
        atleticaId: ATUAL,
        eventoId: dto.primeiraOcorrencia.id,
        timeId: TIME,
        serieId: SERIE,
        autorId: AUTOR.id,
      })
    })

    it('sem datas geradas: SERIE_SEM_OCORRENCIAS e nada gravado', async () => {
      const { servico, tx, dominio } = criarServico()
      const semDatas = {
        ...entrada,
        recorrencia: { ...entrada.recorrencia, dataFim: '2026-10-05', diasSemana: [2] },
      }

      await expect(codigoDaRejeicao(servico.criar(semDatas, AUTOR))).resolves.toBe(
        'SERIE_SEM_OCORRENCIAS',
      )
      expect(tx.serieRecorrencia.create).not.toHaveBeenCalled()
      expect(tx.evento.createManyAndReturn).not.toHaveBeenCalled()
      expect(dominio.emitirAposCommit).not.toHaveBeenCalled()
    })

    it('valida o time antes de gravar', async () => {
      const { servico, tx, validator } = criarServico()
      validator.validarTime.mockRejectedValue(new Error('time'))

      await expect(servico.criar(entrada, AUTOR)).rejects.toThrow('time')
      expect(tx.serieRecorrencia.create).not.toHaveBeenCalled()
    })
  })

  describe('editarSeguintes', () => {
    const horarioELocal: EditarSeguintes = {
      escopo: 'ESTA_E_SEGUINTES',
      horario: '19:00',
      local: 'Quadra 2',
    }
    const seguintes = [5, 6, 7, 8, 9, 10].map((n) => ocorrencia(n))

    it('a partir da 4ª com novo horário divide a série e altera 4 a 10 no próprio dia', async () => {
      const { servico, tx, auditoria, dominio } = criarServico({ seguintes, anteriores: 3 })
      const dto = await servico.editarSeguintes(idOcorrencia(4), horarioELocal, AUTOR)

      expect(dto).toEqual({
        eventoIds: [4, 5, 6, 7, 8, 9, 10].map(idOcorrencia),
        serieId: NOVA_SERIE,
        serieDividida: true,
      })
      expect(tx.serieRecorrencia.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            horario: '19:00',
            local: 'Quadra 2',
            dataInicio: new Date('2026-10-26T00:00:00.000Z'),
            dataFim: new Date('2026-12-07T00:00:00.000Z'),
            diasSemana: [1],
            criadoPorId: AUTOR.id,
          }) as object,
        }),
      )
      expect(tx.evento.updateMany).toHaveBeenCalledWith({
        where: { serieId: SERIE, inicio: { gte: ocorrencia(4).inicio } },
        data: { serieId: NOVA_SERIE },
      })
      expect(tx.serieRecorrencia.update).toHaveBeenCalledWith({
        where: { id: SERIE },
        data: { dataFim: new Date('2026-10-25T00:00:00.000Z') },
      })
      expect(tx.evento.update).toHaveBeenCalledWith({
        where: { id: idOcorrencia(4) },
        data: { inicio: new Date('2026-10-26T22:00:00.000Z'), local: 'Quadra 2' },
      })
      expect(acoes(auditoria)).toEqual(['SERIE_DIVIDIDA'])
      const [[, entradas]] = auditoria.registrarVarios.mock.calls as [[unknown, unknown[]]]
      expect(entradas).toHaveLength(7)
      expect(entradas[0]).toMatchObject({
        acao: 'EVENTO_ALTERADO',
        dados: { contexto: { serieId: NOVA_SERIE, escopo: 'ESTA_E_SEGUINTES' } },
      })
      expect(dominio.emitirAposCommit).toHaveBeenCalledTimes(1)
      expect(dominio.emitirAposCommit).toHaveBeenCalledWith('evento.alterado', {
        atleticaId: ATUAL,
        eventoIds: dto.eventoIds,
        timeId: TIME,
        campos: ['inicio', 'local'],
        autorId: AUTOR.id,
      })
    })

    it('a partir da 1ª não divide: a série recebe horário e local (SERIE_ALTERADA)', async () => {
      const { servico, tx, auditoria } = criarServico({ alvo: ocorrencia(1), anteriores: 0 })
      const dto = await servico.editarSeguintes(idOcorrencia(1), horarioELocal, AUTOR)

      expect(dto).toMatchObject({ serieId: SERIE, serieDividida: false })
      expect(tx.serieRecorrencia.create).not.toHaveBeenCalled()
      expect(tx.serieRecorrencia.update).toHaveBeenCalledWith({
        where: { id: SERIE },
        data: { horario: '19:00', local: 'Quadra 2' },
      })
      expect(acoes(auditoria)).toEqual(['SERIE_ALTERADA'])
    })

    it('anteriores excluídas não contam para a divisão', async () => {
      const { servico, tx } = criarServico()
      await servico.editarSeguintes(idOcorrencia(4), horarioELocal, AUTOR)

      expect(tx.evento.count).toHaveBeenCalledWith({
        where: { serieId: SERIE, inicio: { lt: ocorrencia(4).inicio }, ...naoExcluido },
      })
    })

    it('só o local a partir do meio não cria nem altera série', async () => {
      const { servico, tx, auditoria } = criarServico({ seguintes, anteriores: 3 })
      const dto = await servico.editarSeguintes(
        idOcorrencia(4),
        { escopo: 'ESTA_E_SEGUINTES', local: 'Quadra 2' },
        AUTOR,
      )

      expect(dto.serieDividida).toBe(false)
      expect(tx.serieRecorrencia.create).not.toHaveBeenCalled()
      expect(tx.serieRecorrencia.update).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
    })

    it('o mesmo horário da série não divide', async () => {
      const movida = ocorrencia(4, { inicio: new Date('2026-10-26T23:00:00.000Z') })
      const { servico, tx } = criarServico({ alvo: movida, anteriores: 3 })
      const dto = await servico.editarSeguintes(
        idOcorrencia(4),
        { escopo: 'ESTA_E_SEGUINTES', horario: '18:30' },
        AUTOR,
      )

      expect(dto).toMatchObject({ eventoIds: [idOcorrencia(4)], serieDividida: false })
      expect(tx.serieRecorrencia.create).not.toHaveBeenCalled()
      expect(tx.evento.update).toHaveBeenCalledWith({
        where: { id: idOcorrencia(4) },
        data: { inicio: new Date('2026-10-26T21:30:00.000Z') },
      })
    })

    it('alvo cuja anterior foi movida para o mesmo dia: dataFim não fica antes do início', async () => {
      const segunda = ocorrencia(1, { id: idOcorrencia(2) })
      const { servico, tx } = criarServico({ alvo: segunda, anteriores: 1 })
      await servico.editarSeguintes(idOcorrencia(2), horarioELocal, AUTOR)

      expect(tx.serieRecorrencia.update).toHaveBeenCalledWith({
        where: { id: SERIE },
        data: { dataFim: new Date('2026-10-05T00:00:00.000Z') },
      })
    })

    it('busca só as seguintes AGENDADO e não excluídas', async () => {
      const { servico, tx } = criarServico({ seguintes, anteriores: 3 })
      await servico.editarSeguintes(idOcorrencia(4), horarioELocal, AUTOR)

      expect(tx.evento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            serieId: SERIE,
            inicio: { gt: ocorrencia(4).inicio },
            status: 'AGENDADO',
            excluidoEm: null,
          },
        }),
      )
    })

    it('só observações: altera sem evento de domínio', async () => {
      const { servico, dominio } = criarServico({ anteriores: 3 })
      const dto = await servico.editarSeguintes(
        idOcorrencia(4),
        { escopo: 'ESTA_E_SEGUINTES', observacoes: 'Trazer colete' },
        AUTOR,
      )

      expect(dto.eventoIds).toEqual([idOcorrencia(4)])
      expect(dominio.emitirAposCommit).not.toHaveBeenCalled()
    })

    it.each([
      [{ serieId: null }, 'EVENTO_SEM_SERIE'],
      [{ status: 'CANCELADO' }, 'EVENTO_CANCELADO'],
      [{ status: 'FINALIZADO' }, 'EVENTO_FINALIZADO'],
    ])('alvo %j: %s', async (dados, codigo) => {
      const { servico } = criarServico({ alvo: ocorrencia(4, dados) })
      await expect(
        codigoDaRejeicao(servico.editarSeguintes(idOcorrencia(4), horarioELocal, AUTOR)),
      ).resolves.toBe(codigo)
    })
  })

  describe('cancelarSeguintes', () => {
    it('cancela alvo e seguintes com contexto e emite um evento.cancelado', async () => {
      const { servico, tx, dominio, eventos, auditoria } = criarServico({
        seguintes: [ocorrencia(5), ocorrencia(6)],
        agendadosRestantes: 3,
      })
      const dto = await servico.cancelarSeguintes(idOcorrencia(4), AUTOR)

      const ids = [4, 5, 6].map(idOcorrencia)
      expect(dto).toEqual({ eventoIds: ids, status: 'CANCELADO' })
      expect(eventos.cancelar).toHaveBeenCalledWith(tx, ids, AUTOR, {
        contexto: { serieId: SERIE, escopo: 'ESTA_E_SEGUINTES' },
      })
      expect(tx.serieRecorrencia.updateMany).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
      expect(dominio.emitirAposCommit).toHaveBeenCalledWith('evento.cancelado', {
        atleticaId: ATUAL,
        eventoIds: ids,
        timeId: TIME,
        autorId: AUTOR.id,
      })
    })

    it('sem agendados restantes preenche canceladaEm (SERIE_ALTERADA)', async () => {
      const { servico, tx, auditoria } = criarServico({ alvo: ocorrencia(1) })
      await servico.cancelarSeguintes(idOcorrencia(1), AUTOR)

      expect(tx.serieRecorrencia.updateMany).toHaveBeenCalledWith({
        where: { id: SERIE, canceladaEm: null },
        data: { canceladaEm: AGORA },
      })
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'SerieRecorrencia',
        acao: 'SERIE_ALTERADA',
        entidadeId: SERIE,
        dados: { antes: { canceladaEm: null }, depois: { canceladaEm: AGORA } },
      })
    })

    it('série já cancelada não é auditada de novo', async () => {
      const { servico, tx, auditoria } = criarServico({ alvo: ocorrencia(1) })
      tx.serieRecorrencia.updateMany.mockResolvedValue({ count: 0 })
      await servico.cancelarSeguintes(idOcorrencia(1), AUTOR)

      expect(auditoria.registrar).not.toHaveBeenCalled()
    })

    it.each([
      [{ serieId: null }, 'EVENTO_SEM_SERIE'],
      [{ status: 'FINALIZADO' }, 'EVENTO_FINALIZADO'],
      [{ status: 'CANCELADO' }, 'EVENTO_JA_CANCELADO'],
    ])('alvo %j, mesmo com seguintes agendadas: %s', async (dados, codigo) => {
      const { servico, dominio, eventos } = criarServico({
        alvo: ocorrencia(4, dados),
        seguintes: [ocorrencia(5)],
      })
      await expect(
        codigoDaRejeicao(servico.cancelarSeguintes(idOcorrencia(4), AUTOR)),
      ).resolves.toBe(codigo)
      expect(eventos.cancelar).not.toHaveBeenCalled()
      expect(dominio.emitirAposCommit).not.toHaveBeenCalled()
    })

    it('bloqueia a série antes de cancelar', async () => {
      const { servico, tx, eventos } = criarServico()
      await servico.cancelarSeguintes(idOcorrencia(4), AUTOR)

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        eventos.cancelar.mock.invocationCallOrder[0] ?? 0,
      )
    })

    it('alvo movida para outra série enquanto esperava o bloqueio: CONFLITO_STATUS', async () => {
      const { servico, tx, eventos } = criarServico()
      tx.evento.findFirst
        .mockResolvedValueOnce(ocorrencia(4))
        .mockResolvedValueOnce(ocorrencia(4, { serieId: NOVA_SERIE }))
      await expect(
        codigoDaRejeicao(servico.cancelarSeguintes(idOcorrencia(4), AUTOR)),
      ).resolves.toBe('CONFLITO_STATUS')
      expect(eventos.cancelar).not.toHaveBeenCalled()
    })

    it('alvo cancelável sem nada cancelado (concorrência): EVENTO_JA_CANCELADO', async () => {
      const { servico, dominio } = criarServico({ cancelados: [] })
      await expect(
        codigoDaRejeicao(servico.cancelarSeguintes(idOcorrencia(4), AUTOR)),
      ).resolves.toBe('EVENTO_JA_CANCELADO')
      expect(dominio.emitirAposCommit).not.toHaveBeenCalled()
    })
  })

  it('não usa offset fixo de fuso', () => {
    for (const arquivo of [
      join(__dirname, 'series-recorrencia.service.ts'),
      join(dirname(require.resolve('@atletica/shared/package.json')), 'src/eventos/recorrencia.ts'),
    ]) {
      expect(readFileSync(arquivo, 'utf8')).not.toMatch(/-03:?00/)
    }
  })
})
