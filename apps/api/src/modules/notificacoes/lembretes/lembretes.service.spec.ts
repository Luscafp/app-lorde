import { HORA_MS } from '../../../common/tempo'
import type { ContextoAtletica } from '../../../infra/contexto/contexto-atletica.service'
import type { FilaService } from '../../../infra/fila/fila.service'
import type { PrismaService } from '../../../infra/prisma/prisma.service'
import type { DestinatariosService } from '../destinatarios.service'
import type { NotificacoesService } from '../notificacoes.service'
import { LembretesService } from './lembretes.service'

const AGORA = new Date('2026-10-10T12:00:00.000Z')
const ID = '0f8b2c4e-1a3d-4e5f-9a7b-6c5d4e3f2a1b'
const daquiA = (horas: number) => new Date(AGORA.getTime() + horas * HORA_MS)
const INICIO = daquiA(2)

const EVENTO = {
  id: ID,
  atleticaId: 'atl-1',
  tipo: 'JOGO',
  timeId: 't1',
  inicio: INICIO,
  local: 'Ginásio',
  status: 'AGENDADO',
  criadoEm: daquiA(-72),
  excluidoEm: null,
  time: { nome: 'Futsal' },
}

function preparar() {
  const db = {
    atletica: { findMany: jest.fn().mockResolvedValue([{ id: 'atl-1' }, { id: 'atl-2' }]) },
    evento: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    participacao: { findMany: jest.fn().mockResolvedValue([]) },
  }
  const fila = {
    criarFila: jest.fn(),
    trabalhar: jest.fn(),
    agendar: jest.fn(),
    enviar: jest.fn().mockResolvedValue('job'),
  }
  const executarComAtletica = jest.fn((_id: string, fn: () => unknown) => Promise.resolve(fn()))
  const elencoDoTime = jest.fn().mockResolvedValue(['a', 'b', 'c'])
  const notificar = jest.fn().mockResolvedValue({ destinatarios: 1 })
  const servico = new LembretesService(
    { db } as unknown as PrismaService,
    fila as unknown as FilaService,
    { executarComAtletica } as unknown as ContextoAtletica,
    { elencoDoTime } as unknown as DestinatariosService,
    { notificar } as unknown as NotificacoesService,
  )
  return { servico, db, fila, executarComAtletica, elencoDoTime, notificar }
}

describe('LembretesService', () => {
  it('registra as 3 filas, os workers e o cron de 15 min', async () => {
    const { servico, fila } = preparar()

    await servico.onModuleInit()

    expect(fila.criarFila.mock.calls.map(([nome]) => nome as string)).toEqual([
      'notificacao.lembrete',
      'notificacao.confirmacao-pendente',
      'notificacao.reconciliar',
    ])
    expect(fila.trabalhar).toHaveBeenCalledTimes(3)
    expect(fila.agendar).toHaveBeenCalledWith('notificacao.reconciliar', '*/15 * * * *')
  })

  describe('reconciliação', () => {
    it('roda por atlética, no contexto dela, só eventos AGENDADO nas próximas 48 h', async () => {
      const { servico, db, executarComAtletica } = preparar()

      await servico.reconciliar(AGORA)

      expect(db.atletica.findMany).toHaveBeenCalledWith({
        where: { usaAplicativo: true },
        select: { id: true },
      })
      expect(executarComAtletica.mock.calls.map(([id]) => id)).toEqual(['atl-1', 'atl-2'])
      expect(db.evento.findMany).toHaveBeenCalledWith({
        where: {
          AND: [{}],
          excluidoEm: null,
          status: 'AGENDADO',
          inicio: { gt: AGORA, lte: daquiA(48) },
        },
        select: { id: true, inicio: true, criadoEm: true },
      })
    })

    it('envia os jobs com startAfter, singletonKey e inicioPrevisto; conta só os criados', async () => {
      const { servico, db, fila } = preparar()
      db.evento.findMany.mockResolvedValue([{ id: ID, inicio: daquiA(3), criadoEm: AGORA }])
      fila.enviar.mockResolvedValueOnce('job-1').mockResolvedValueOnce(null)

      const criados = await servico.reconciliarEventos('atl-1', { id: ID }, AGORA)

      expect(criados).toBe(1)
      expect(fila.enviar).toHaveBeenCalledTimes(2)
      expect(fila.enviar).toHaveBeenNthCalledWith(
        1,
        'notificacao.lembrete',
        { atleticaId: 'atl-1', eventoId: ID, horas: 1, inicioPrevisto: daquiA(3).toISOString() },
        {
          startAfter: daquiA(2),
          singletonKey: `lembrete:${ID}:1:${daquiA(3).toISOString()}`,
        },
      )
    })

    it('confirmação pendente vai para a fila própria, sem horas no payload', async () => {
      const { servico, db, fila } = preparar()
      db.evento.findMany.mockResolvedValue([{ id: ID, inicio: daquiA(30), criadoEm: daquiA(-1) }])

      await servico.reconciliarEventos('atl-1', { id: ID }, AGORA)

      expect(fila.enviar).toHaveBeenCalledWith(
        'notificacao.confirmacao-pendente',
        { atleticaId: 'atl-1', eventoId: ID, inicioPrevisto: daquiA(30).toISOString() },
        expect.objectContaining({ startAfter: daquiA(6) }),
      )
    })
  })

  describe('lembrete', () => {
    const payload = {
      atleticaId: 'atl-1',
      eventoId: ID,
      horas: 2,
      inicioPrevisto: INICIO.toISOString(),
    }

    it('elenco que confirmou e escolheu a antecedência; padrão 2 h sem preferência', async () => {
      const { servico, db, notificar, elencoDoTime } = preparar()
      db.evento.findUnique.mockResolvedValue(EVENTO)
      db.participacao.findMany.mockResolvedValue([{ usuarioId: 'a' }])

      await servico.lembrar(payload, AGORA)

      expect(elencoDoTime).toHaveBeenCalledWith('t1')
      expect(db.participacao.findMany).toHaveBeenCalledWith({
        where: {
          eventoId: ID,
          confirmado: true,
          usuarioId: { in: ['a', 'b', 'c'] },
          usuario: {
            OR: [
              { preferencia: { is: { antecedenciaLembreteHoras: 2 } } },
              { preferencia: { is: null } },
            ],
          },
        },
        select: { usuarioId: true },
      })
      expect(notificar).toHaveBeenCalledWith({
        atleticaId: 'atl-1',
        categoria: 'LEMBRETES',
        usuarioIds: ['a'],
        titulo: 'Lembrete: jogo em 2 h',
        corpo: 'Futsal · 11:00 · Ginásio',
        url: `/eventos/${ID}`,
        chave: `lembrete:${ID}:2:${INICIO.toISOString()}`,
        ttl: 2 * 3600,
      })
    })

    it('antecedência diferente da padrão não inclui quem não tem preferência', async () => {
      const { servico, db } = preparar()
      db.evento.findUnique.mockResolvedValue({ ...EVENTO, inicio: daquiA(24) })

      await servico.lembrar(
        { ...payload, horas: 24, inicioPrevisto: daquiA(24).toISOString() },
        AGORA,
      )

      const [{ where }] = db.participacao.findMany.mock.calls[0] as [
        { where: { usuario: { OR: unknown[] } } },
      ]
      expect(where.usuario.OR).toEqual([{ preferencia: { is: { antecedenciaLembreteHoras: 24 } } }])
    })

    it('job obsoleto (início mudou) termina sem enviar', async () => {
      const { servico, db, notificar } = preparar()
      db.evento.findUnique.mockResolvedValue({ ...EVENTO, inicio: daquiA(26) })

      await servico.lembrar(payload, AGORA)

      expect(db.participacao.findMany).not.toHaveBeenCalled()
      expect(notificar).not.toHaveBeenCalled()
    })

    it('evento cancelado ou inexistente termina sem enviar', async () => {
      const { servico, db, notificar } = preparar()
      db.evento.findUnique.mockResolvedValueOnce({ ...EVENTO, status: 'CANCELADO' })
      db.evento.findUnique.mockResolvedValueOnce(null)

      await servico.lembrar(payload, AGORA)
      await servico.lembrar(payload, AGORA)

      expect(notificar).not.toHaveBeenCalled()
    })
  })

  describe('confirmação pendente', () => {
    const inicio = daquiA(24)
    const payload = { atleticaId: 'atl-1', eventoId: ID, inicioPrevisto: inicio.toISOString() }

    it('elenco sem resposta recebe "Você vai?"', async () => {
      const { servico, db, notificar } = preparar()
      db.evento.findUnique.mockResolvedValue({ ...EVENTO, inicio })
      db.participacao.findMany.mockResolvedValue([{ usuarioId: 'b' }])

      await servico.confirmarPendente(payload, AGORA)

      expect(db.participacao.findMany).toHaveBeenCalledWith({
        where: { eventoId: ID, confirmado: { not: null } },
        select: { usuarioId: true },
      })
      expect(notificar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'LEMBRETES',
          usuarioIds: ['a', 'c'],
          titulo: 'Você vai?',
          chave: `confirmacao-pendente:${ID}:24:${inicio.toISOString()}`,
          ttl: 24 * 3600,
        }),
      )
    })

    it('evento criado com menos de 24 h de antecedência não recebe', async () => {
      const { servico, db, notificar } = preparar()
      db.evento.findUnique.mockResolvedValue({ ...EVENTO, inicio, criadoEm: daquiA(1) })

      await servico.confirmarPendente(payload, AGORA)

      expect(notificar).not.toHaveBeenCalled()
    })
  })
})
