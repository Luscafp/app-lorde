import type { PrismaService } from '../../../infra/prisma/prisma.service'
import type { DestinatariosService } from '../destinatarios.service'
import type { EntradaNotificacao, NotificacoesService } from '../notificacoes.service'
import { GatilhosService, semAutor } from './gatilhos.service'

const EVENTO_ID = '0f8b2c4e-1a3d-4e5f-9a7b-6c5d4e3f2a1b'
const OUTRO_EVENTO_ID = '1f8b2c4e-1a3d-4e5f-9a7b-6c5d4e3f2a1b'
const TIME_ID = '2f8b2c4e-1a3d-4e5f-9a7b-6c5d4e3f2a1b'

const linhaEvento = (id: string, inicio: string) => ({
  id,
  tipo: 'TREINO',
  inicio: new Date(inicio),
  local: 'Quadra',
  resultado: null,
  placarTime: null,
  placarAdversario: null,
  time: { nome: 'Vôlei' },
  timeAdversario: null,
})

function preparar() {
  const db = {
    evento: { findMany: jest.fn().mockResolvedValue([]) },
    serieRecorrencia: { findFirst: jest.fn() },
    noticia: { findFirst: jest.fn() },
    solicitacaoEntrada: { findFirst: jest.fn() },
    time: { findFirst: jest.fn().mockResolvedValue({ nome: 'Vôlei' }) },
    atletica: { findUniqueOrThrow: jest.fn().mockResolvedValue({ nome: 'Lorde', sigla: 'LRD' }) },
  }
  const destinatarios = {
    elencoDoTime: jest.fn().mockResolvedValue(['autor', 'u1', 'u2']),
    diretoria: jest.fn().mockResolvedValue(['d1', 'd2']),
    todosDaAtletica: jest.fn().mockResolvedValue(['autor', 'u1', 'u2', 'u3']),
  }
  const notificar = jest.fn().mockResolvedValue({ destinatarios: 1 })
  const servico = new GatilhosService(
    { db } as unknown as PrismaService,
    destinatarios as unknown as DestinatariosService,
    { notificar } as unknown as NotificacoesService,
  )
  const enviado = () => (notificar.mock.calls as [EntradaNotificacao][])[0]?.[0]
  return { servico, db, destinatarios, notificar, enviado }
}

describe('semAutor', () => {
  it('remove o autor; null (sistema) não remove ninguém', () => {
    expect(semAutor(['a', 'b'], 'a')).toEqual(['b'])
    expect(semAutor(['a', 'b'], null)).toEqual(['a', 'b'])
  })
})

describe('GatilhosService', () => {
  it('evento criado: elenco do time sem o autor, NOVOS_EVENTOS e chave única', async () => {
    const { servico, db, destinatarios, notificar, enviado } = preparar()
    db.evento.findMany.mockResolvedValue([linhaEvento(EVENTO_ID, '2026-10-12T22:00:00Z')])
    const payload = { atleticaId: 'atl', eventoId: EVENTO_ID, timeId: TIME_ID, autorId: 'autor' }

    await servico.disparar('evento.criado', payload)
    await servico.disparar('evento.criado', payload)

    expect(destinatarios.elencoDoTime).toHaveBeenCalledWith(TIME_ID)
    expect(enviado()).toMatchObject({
      atleticaId: 'atl',
      categoria: 'NOVOS_EVENTOS',
      usuarioIds: ['u1', 'u2'],
      titulo: 'Novo treino: Vôlei',
      url: `/eventos/${EVENTO_ID}`,
      chave: expect.stringMatching(/^evento\.criado:[0-9a-f-]{36}$/) as string,
    })
    const [[{ chave: primeira }], [{ chave: segunda }]] = notificar.mock.calls as [
      [{ chave: string }],
      [{ chave: string }],
    ]
    expect(primeira).not.toBe(segunda)
  })

  it('série criada: texto da série e link para a 1ª ocorrência', async () => {
    const { servico, db, enviado } = preparar()
    db.serieRecorrencia.findFirst.mockResolvedValue({
      diasSemana: [1, 3],
      horario: '19:00',
      dataFim: new Date('2027-03-31'),
      local: 'Quadra',
      time: { nome: 'Vôlei' },
    })

    await servico.disparar('evento.criado', {
      atleticaId: 'atl',
      eventoId: EVENTO_ID,
      timeId: TIME_ID,
      serieId: 's1',
      autorId: 'autor',
    })

    expect(db.evento.findMany).not.toHaveBeenCalled()
    expect(enviado()).toMatchObject({
      titulo: 'Novo treino recorrente: Vôlei',
      url: `/eventos/${EVENTO_ID}`,
    })
  })

  it.each([
    [['status'], false],
    [['inicio'], true],
    [['local'], true],
    [['status', 'local'], true],
  ] as const)('evento alterado com campos %j notifica? %s', async (campos, notifica) => {
    const { servico, db, notificar } = preparar()
    db.evento.findMany.mockResolvedValue([linhaEvento(EVENTO_ID, '2026-10-12T22:00:00Z')])

    await servico.disparar('evento.alterado', {
      atleticaId: 'atl',
      eventoIds: [EVENTO_ID],
      timeId: TIME_ID,
      campos: [...campos],
      autorId: 'autor',
    })

    expect(notificar).toHaveBeenCalledTimes(notifica ? 1 : 0)
  })

  it('vários eventos alterados: uma notificação com link para o time', async () => {
    const { servico, db, notificar, enviado } = preparar()
    db.evento.findMany.mockResolvedValue([
      linhaEvento(EVENTO_ID, '2026-10-12T22:00:00Z'),
      linhaEvento(OUTRO_EVENTO_ID, '2026-10-14T22:00:00Z'),
    ])

    await servico.disparar('evento.alterado', {
      atleticaId: 'atl',
      eventoIds: [EVENTO_ID, OUTRO_EVENTO_ID],
      timeId: TIME_ID,
      campos: ['inicio'],
      autorId: 'autor',
    })

    expect(notificar).toHaveBeenCalledTimes(1)
    expect(enviado()).toMatchObject({
      categoria: 'ALTERACOES_EVENTOS',
      titulo: 'Treinos de Vôlei alterados',
      url: `/times/${TIME_ID}`,
    })
  })

  it('evento cancelado de um evento só abre o detalhe', async () => {
    const { servico, db, enviado } = preparar()
    db.evento.findMany.mockResolvedValue([linhaEvento(EVENTO_ID, '2026-10-12T22:00:00Z')])

    await servico.disparar('evento.cancelado', {
      atleticaId: 'atl',
      eventoIds: [EVENTO_ID],
      timeId: TIME_ID,
      autorId: 'autor',
    })

    expect(enviado()).toMatchObject({
      categoria: 'ALTERACOES_EVENTOS',
      titulo: 'Evento cancelado',
      url: `/eventos/${EVENTO_ID}`,
    })
  })

  it('resultado: todos da atlética sem o autor, sigla no título', async () => {
    const { servico, db, enviado } = preparar()
    db.evento.findMany.mockResolvedValue([
      {
        ...linhaEvento(EVENTO_ID, '2026-10-12T22:00:00Z'),
        tipo: 'JOGO',
        resultado: 'VITORIA',
        placarTime: 3,
        placarAdversario: 1,
        timeAdversario: { atletica: { nome: 'Medicina' } },
      },
    ])

    await servico.disparar('evento.resultadoRegistrado', {
      atleticaId: 'atl',
      eventoId: EVENTO_ID,
      autorId: 'autor',
    })

    expect(enviado()).toMatchObject({
      categoria: 'RESULTADOS',
      usuarioIds: ['u1', 'u2', 'u3'],
      titulo: 'Vitória da LRD',
      corpo: 'Vôlei 3 x 1 Medicina',
    })
  })

  it('sem sigla, usa o nome da atlética', async () => {
    const { servico, db, enviado } = preparar()
    db.atletica.findUniqueOrThrow.mockResolvedValue({ nome: 'Atlética X', sigla: null })
    db.noticia.findFirst.mockResolvedValue({ titulo: 'Inscrições abertas' })

    await servico.disparar('noticia.publicada', {
      atleticaId: 'atl',
      noticiaId: EVENTO_ID,
      autorId: 'autor',
    })

    expect(enviado()).toMatchObject({
      categoria: 'NOTICIAS',
      titulo: 'Atlética X publicou uma notícia',
      url: `/noticias/${EVENTO_ID}`,
    })
  })

  it('solicitação criada vai à diretoria; avaliada vai ao solicitante', async () => {
    const { servico, db, destinatarios, notificar } = preparar()
    db.solicitacaoEntrada.findFirst.mockResolvedValue({
      usuario: { nome: 'Ana' },
      time: { nome: 'Vôlei' },
    })

    await servico.disparar('solicitacao.criada', {
      atleticaId: 'atl',
      solicitacaoId: 's1',
      timeId: TIME_ID,
      autorId: 'atleta',
    })
    await servico.disparar('solicitacao.avaliada', {
      atleticaId: 'atl',
      solicitacaoId: 's1',
      timeId: TIME_ID,
      usuarioId: 'atleta',
      status: 'APROVADA',
      autorId: 'd1',
    })

    expect(destinatarios.diretoria).toHaveBeenCalledWith('atl')
    expect(notificar.mock.calls.map(([entrada]) => entrada as object)).toEqual([
      expect.objectContaining({
        usuarioIds: ['d1', 'd2'],
        corpo: 'Ana quer entrar em Vôlei.',
        url: '/painel/solicitacoes',
      }),
      expect.objectContaining({
        usuarioIds: ['atleta'],
        titulo: 'Solicitação aprovada',
        url: `/times/${TIME_ID}`,
      }),
    ])
  })

  it('cargo: categoria CARGO para o usuário afetado', async () => {
    const { servico, enviado } = preparar()

    await servico.disparar('usuario.papelAlterado', {
      atleticaId: 'atl',
      usuarioId: 'u1',
      papelAnterior: 'ATLETA',
      papelNovo: 'DIRETOR',
      autorId: 'admin',
    })

    expect(enviado()).toMatchObject({
      categoria: 'CARGO',
      usuarioIds: ['u1'],
      titulo: 'Seu cargo foi alterado',
      url: '/perfil',
    })
  })

  it('só o autor como destinatário: não lê dados nem notifica', async () => {
    const { servico, db, notificar } = preparar()

    await servico.disparar('solicitacao.avaliada', {
      atleticaId: 'atl',
      solicitacaoId: 's1',
      timeId: TIME_ID,
      usuarioId: 'd1',
      status: 'REJEITADA',
      autorId: 'd1',
    })

    expect(db.time.findFirst).not.toHaveBeenCalled()
    expect(notificar).not.toHaveBeenCalled()
  })

  it('dado de exibição ausente (notícia excluída) não notifica', async () => {
    const { servico, db, notificar } = preparar()
    db.noticia.findFirst.mockResolvedValue(null)

    await servico.disparar('noticia.publicada', {
      atleticaId: 'atl',
      noticiaId: EVENTO_ID,
      autorId: 'autor',
    })

    expect(notificar).not.toHaveBeenCalled()
  })

  it('resultado ainda sem placar não notifica', async () => {
    const { servico, db, notificar } = preparar()
    db.evento.findMany.mockResolvedValue([
      { ...linhaEvento(EVENTO_ID, '2026-10-12T22:00:00Z'), tipo: 'JOGO' },
    ])

    await servico.disparar('evento.resultadoRegistrado', {
      atleticaId: 'atl',
      eventoId: EVENTO_ID,
      autorId: 'autor',
    })

    expect(notificar).not.toHaveBeenCalled()
  })
})
