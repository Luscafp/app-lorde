import { eventoDetalheSchema, participacaoRespondidaDtoSchema, type Papel } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import type { Evento, Time } from '../../src/generated/prisma/client'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarTreino, type DadosEvento } from '../fabricas/eventos'
import { adicionarMembro, criarTime } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/eventos'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const DIA_MS = 24 * 60 * 60 * 1000
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

/** Só o `Date` fica parado; timers reais para o Postgres e o Nest. */
function congelarRelogio(instante: string) {
  jest.useFakeTimers({
    now: new Date(instante),
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  })
}

describe('PUT /eventos/:id/participacao (#24)', () => {
  let contexto: AppDeTeste
  let atleticaId: string
  let time: Time

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica()).id
    time = await criarTime({ atleticaId })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  async function membro(papel: Papel = 'ATLETA'): Promise<UsuarioCriado> {
    const usuario = await criarUsuario({ papel, atleticaId })
    await adicionarMembro(time, usuario)
    return usuario
  }

  async function como(usuario: UsuarioCriado) {
    const auth = `Bearer ${await tokenPara(usuario)}`
    return {
      responder: (id: string, corpo: unknown) =>
        request(contexto.http)
          .put(`${ROTA}/${id}/participacao`)
          .set('Authorization', auth)
          .send(corpo as object),
      detalhar: (id: string) =>
        request(contexto.http).get(`${ROTA}/${id}`).set('Authorization', auth),
    }
  }

  const treino = (dados: Partial<DadosEvento> = {}) =>
    criarTreino({ atleticaId, timeId: time.id, inicio: new Date(Date.now() + DIA_MS), ...dados })

  const linha = (evento: Evento, usuario: UsuarioCriado) =>
    prismaTeste.participacao.findUnique({
      where: { eventoId_usuarioId: { eventoId: evento.id, usuarioId: usuario.id } },
    })

  it('"Vou", depois "Não vou": upsert com novo respondidoEm e contagem igual à do detalhe (critérios 1 e 2)', async () => {
    const eu = await membro()
    const outro = await membro()
    const evento = await treino({ participantes: [{ usuarioId: outro.id, confirmado: true }] })
    const cliente = await como(eu)

    const vou = await cliente.responder(evento.id, { confirmado: true })
    expect(vou.status).toBe(200)
    expect(vou.headers['cache-control']).toBe('no-store')
    const primeira = participacaoRespondidaDtoSchema.parse(vou.body)
    expect(primeira).toMatchObject({
      eventoId: evento.id,
      confirmado: true,
      contagem: { confirmados: 2, recusados: 0, semResposta: 0, elenco: 2 },
    })
    expect(Math.abs(Date.parse(primeira.respondidoEm) - Date.now())).toBeLessThan(10_000)

    const naoVou = await cliente.responder(evento.id, { confirmado: false })
    expect(naoVou.status).toBe(200)
    const segunda = participacaoRespondidaDtoSchema.parse(naoVou.body)
    expect(segunda.contagem).toEqual({ confirmados: 1, recusados: 1, semResposta: 0, elenco: 2 })
    expect(Date.parse(segunda.respondidoEm)).toBeGreaterThanOrEqual(
      Date.parse(primeira.respondidoEm),
    )

    const detalhe = eventoDetalheSchema.parse((await cliente.detalhar(evento.id)).body)
    expect(detalhe.contagem).toEqual(segunda.contagem)
    expect(detalhe.minhaParticipacao).toEqual({
      confirmado: false,
      respondidoEm: segunda.respondidoEm,
    })
    expect(await prismaTeste.participacao.count({ where: { eventoId: evento.id } })).toBe(2)
  })

  it('mesma resposta é idempotente: 200 sem alterar respondidoEm (critério 3)', async () => {
    const eu = await membro()
    const evento = await treino()
    const cliente = await como(eu)

    const primeira = await cliente.responder(evento.id, { confirmado: true }).expect(200)
    const segunda = await cliente.responder(evento.id, { confirmado: true }).expect(200)

    const { respondidoEm } = participacaoRespondidaDtoSchema.parse(primeira.body)
    expect(participacaoRespondidaDtoSchema.parse(segunda.body).respondidoEm).toBe(respondidoEm)
  })

  it('presença registrada é preservada ao trocar a resposta (critério 12)', async () => {
    const eu = await membro()
    const evento = await treino({
      participantes: [{ usuarioId: eu.id, confirmado: true, presente: true }],
    })
    const antes = await linha(evento, eu)

    await (await como(eu)).responder(evento.id, { confirmado: false }).expect(200)

    const depois = await linha(evento, eu)
    expect(depois).toMatchObject({
      confirmado: false,
      presente: true,
      presencaRegistradaEm: antes?.presencaRegistradaEm,
    })
  })

  it.each<[string, (usuario: UsuarioCriado) => Promise<unknown>]>([
    ['Diretor fora do elenco', () => Promise.resolve()],
    ['ex-membro', (usuario) => adicionarMembro(time, usuario, { saidaEm: new Date() })],
    [
      'membro de outro time',
      async (usuario) => adicionarMembro(await criarTime({ atleticaId }), usuario),
    ],
  ])('%s → 403 NAO_MEMBRO_DO_ELENCO sem gravar (critério 4)', async (_, preparar) => {
    const usuario = await criarUsuario({ papel: 'DIRETOR', atleticaId })
    await preparar(usuario)
    const evento = await treino()

    const resposta = await (await como(usuario)).responder(evento.id, { confirmado: true })

    expect(resposta.status).toBe(403)
    expect(erro(resposta)).toMatchObject({
      code: 'NAO_MEMBRO_DO_ELENCO',
      message: 'Apenas membros do elenco podem confirmar participação.',
    })
    expect(await linha(evento, usuario)).toBeNull()
  })

  it.each([
    ['CANCELADO', 'EVENTO_CANCELADO'],
    ['EM_ANDAMENTO', 'EVENTO_NAO_AGENDADO'],
    ['FINALIZADO', 'EVENTO_NAO_AGENDADO'],
  ] as const)('evento %s → 422 %s (critérios 6 e 7)', async (status, codigo) => {
    const eu = await membro()
    const evento = await treino({ status })

    const resposta = await (await como(eu)).responder(evento.id, { confirmado: true })

    expect(resposta.status).toBe(422)
    expect(erro(resposta).code).toBe(codigo)
    expect(await linha(evento, eu)).toBeNull()
  })

  it('aceita 1 ms antes do início e bloqueia no início; 00:30 local de 11/10 (critério 8)', async () => {
    const eu = await membro()
    const evento = await treino({ inicio: new Date('2026-10-11T03:30:00.000Z') })

    congelarRelogio('2026-10-11T03:29:00.000Z')
    await (await como(eu)).responder(evento.id, { confirmado: true }).expect(200)

    congelarRelogio('2026-10-11T03:29:59.999Z')
    await (await como(eu)).responder(evento.id, { confirmado: false }).expect(200)

    congelarRelogio('2026-10-11T03:30:00.000Z')
    const resposta = await (await como(eu)).responder(evento.id, { confirmado: true })
    expect(resposta.status).toBe(422)
    expect(erro(resposta).code).toBe('EVENTO_JA_INICIADO')
    expect((await linha(evento, eu))?.confirmado).toBe(false)
  })

  it('404 para inexistente, excluído e de outra atlética; 401 sem token (critério 10)', async () => {
    const eu = await membro()
    const excluido = await treino({ excluidoEm: new Date() })
    const alheio = await criarTreino({ atleticaId: (await criarAtletica()).id })
    const cliente = await como(eu)

    for (const id of [ID_INEXISTENTE, excluido.id, alheio.id]) {
      const resposta = await cliente.responder(id, { confirmado: true })
      expect(resposta.status).toBe(404)
      expect(erro(resposta).code).toBe('NOT_FOUND')
    }

    const semToken = await request(contexto.http)
      .put(`${ROTA}/${excluido.id}/participacao`)
      .send({ confirmado: true })
    expect(semToken.status).toBe(401)
    expect(erro(semToken).code).toBe('UNAUTHENTICATED')
  })

  it.each([
    ['vazio', {}],
    ['confirmado texto', { confirmado: 'sim' }],
    ['usuarioId extra', { confirmado: true, usuarioId: ID_INEXISTENTE }],
  ])('corpo %s → 400 VALIDATION_ERROR (critério 11)', async (_, corpo) => {
    const eu = await membro()
    const evento = await treino()

    const resposta = await (await como(eu)).responder(evento.id, corpo)

    expect(resposta.status).toBe(400)
    expect(erro(resposta).code).toBe('VALIDATION_ERROR')
    expect(await linha(evento, eu)).toBeNull()
  })

  it('id não-UUID → 400 VALIDATION_ERROR', async () => {
    const resposta = await (await como(await membro())).responder('abc', { confirmado: true })
    expect(resposta.status).toBe(400)
    expect(erro(resposta).code).toBe('VALIDATION_ERROR')
  })

  it('10 PUT simultâneos do mesmo usuário → todos 200 e uma única linha', async () => {
    const eu = await membro()
    const evento = await treino()
    const cliente = await como(eu)

    const respostas = await Promise.all(
      Array.from({ length: 10 }, () => cliente.responder(evento.id, { confirmado: true })),
    )

    expect(respostas.map(({ status }) => status)).toEqual(Array(10).fill(200))
    expect(await prismaTeste.participacao.count({ where: { eventoId: evento.id } })).toBe(1)
  })
})
