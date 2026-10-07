import {
  eventoDetalheSchema,
  listaEventosSchema,
  type EventoResumoDto,
  type Papel,
} from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import type { Evento, Modalidade, Time } from '../../src/generated/prisma/client'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import {
  criarJogo,
  criarParticipacoes,
  criarSerie,
  criarTreino,
  type DadosEvento,
} from '../fabricas/eventos'
import { criarModalidade } from '../fabricas/modalidades'
import {
  adicionarMembro,
  criarAtleticaAdversaria,
  criarTime,
  criarTimeAdversario,
} from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'
import { contarConsultas } from '../suporte/contador-consultas'

const ROTA = '/api/v1/eventos'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const DIA_MS = 24 * 60 * 60 * 1000
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro
const emDias = (dias: number) => new Date(Date.now() + dias * DIA_MS)

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

describe('/eventos — leitura (#75)', () => {
  let contexto: AppDeTeste
  let atleticaId: string
  let volei: Modalidade
  let futsal: Modalidade
  let time: Time
  let timeFutsal: Time
  let adversario: Time
  let autorId: string

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica()).id
    autorId = (await criarUsuario({ papel: 'DIRETOR', atleticaId })).id
    volei = await criarModalidade({ nome: 'Vôlei', icone: 'volleyball' })
    futsal = await criarModalidade({ nome: 'Futsal', icone: 'soccer' })
    time = await criarTime({ atleticaId, modalidadeId: volei.id, nome: 'Vôlei Masculino' })
    timeFutsal = await criarTime({ atleticaId, modalidadeId: futsal.id, nome: 'Futsal' })
    const medicina = await criarAtleticaAdversaria({ nome: 'Atlética Medicina', sigla: 'AAMED' })
    adversario = await criarTimeAdversario({ atleticaId: medicina.id, modalidadeId: volei.id })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  const usuario = (papel: Papel = 'ATLETA') => criarUsuario({ papel, atleticaId })

  async function como(papel: Papel | UsuarioCriado = 'ATLETA') {
    const alvo = typeof papel === 'string' ? await usuario(papel) : papel
    const auth = `Bearer ${await tokenPara(alvo)}`
    return {
      listar: (query: Record<string, string | number | boolean> = {}) =>
        request(contexto.http).get(ROTA).query(query).set('Authorization', auth),
      detalhar: (id: string) =>
        request(contexto.http).get(`${ROTA}/${id}`).set('Authorization', auth),
    }
  }

  const treino = (dados: Partial<DadosEvento> = {}) =>
    criarTreino({ atleticaId, timeId: time.id, criadoPorId: autorId, inicio: emDias(1), ...dados })
  const jogo = (dados: Partial<DadosEvento> = {}) =>
    criarJogo({
      atleticaId,
      timeId: time.id,
      timeAdversarioId: adversario.id,
      criadoPorId: autorId,
      inicio: emDias(1),
      ...dados,
    })

  async function idsListados(
    papel: Papel | UsuarioCriado,
    query: Record<string, string | number | boolean> = {},
  ): Promise<string[]> {
    const resposta = await (await como(papel)).listar(query)
    expect(resposta.status).toBe(200)
    return listaEventosSchema.parse(resposta.body).items.map(({ id }) => id)
  }

  describe('autenticação e validação', () => {
    it('sem token → 401 nas duas rotas (critério 16)', async () => {
      const evento = await treino()
      for (const rota of [ROTA, `${ROTA}/${evento.id}`]) {
        const resposta = await request(contexto.http).get(rota)
        expect(resposta.status).toBe(401)
        expect(erro(resposta).code).toBe('UNAUTHENTICATED')
      }
    })

    it.each([
      ['limit=51', { limit: 51 }, 'limit'],
      ['periodo=OUTRO', { periodo: 'OUTRO' }, 'periodo'],
      ['modalidadeId não-UUID', { modalidadeId: 'volei' }, 'modalidadeId'],
      ['status desconhecido', { status: 'AGENDADO,ADIADO' }, 'status'],
      ['usuarioId na query', { usuarioId: ID_INEXISTENTE }, ''],
    ])('%s → 400 VALIDATION_ERROR (critério 17)', async (_caso, query, campo) => {
      const resposta = await (await como()).listar(query)
      expect(resposta.status).toBe(400)
      expect(erro(resposta)).toMatchObject({ code: 'VALIDATION_ERROR' })
      expect(erro(resposta).details.map(({ field }) => field)).toContain(campo)
    })

    it('id não-UUID → 400', async () => {
      const resposta = await (await como()).detalhar('abc')
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /eventos', () => {
    it('ATLETA lista os próximos com o resumo completo, sem cache', async () => {
      const evento = await jogo()
      const resposta = await (await como()).listar()

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const lista = listaEventosSchema.parse(resposta.body)
      expect(lista).toMatchObject({ page: 1, limit: 20, total: 1 })
      expect(lista.items[0]).toEqual<EventoResumoDto>({
        id: evento.id,
        tipo: 'JOGO',
        status: 'AGENDADO',
        inicio: evento.inicio.toISOString(),
        local: evento.local,
        serieId: null,
        time: { id: time.id, nome: 'Vôlei Masculino' },
        modalidade: { id: volei.id, nome: 'Vôlei', icone: 'volleyball' },
        timeAdversario: {
          id: adversario.id,
          nome: adversario.nome,
          atletica: { id: adversario.atleticaId, nome: 'Atlética Medicina', sigla: 'AAMED' },
        },
        placarTime: null,
        placarAdversario: null,
        resultado: null,
        souMembro: false,
        minhaParticipacao: null,
      })
    })

    it('nunca mostra eventos de outra atlética nem excluídos', async () => {
      const visivel = await treino()
      await treino({ excluidoEm: new Date() })
      const outra = await criarAtletica()
      await criarTreino({ atleticaId: outra.id, inicio: emDias(1) })

      expect(await idsListados('ATLETA', { periodo: 'TODOS' })).toEqual([visivel.id])
    })

    it('PROXIMOS em ordem crescente; PASSADOS e TODOS em decrescente; `ordem` sobrepõe', async () => {
      const amanha = await treino({ inicio: emDias(1) })
      const depois = await treino({ inicio: emDias(2) })
      const passado = await treino({ inicio: emDias(-2), status: 'FINALIZADO' })

      expect(await idsListados('ATLETA')).toEqual([amanha.id, depois.id])
      expect(await idsListados('ATLETA', { periodo: 'PASSADOS' })).toEqual([passado.id])
      expect(await idsListados('ATLETA', { periodo: 'TODOS' })).toEqual([
        depois.id,
        amanha.id,
        passado.id,
      ])
      expect(await idsListados('ATLETA', { periodo: 'TODOS', ordem: 'asc' })).toEqual([
        passado.id,
        amanha.id,
        depois.id,
      ])
    })

    describe('periodo com relógio fixo (RN18, critérios 7–9)', () => {
      // 12:00 de 07/10 em Fortaleza.
      const AGORA = '2026-10-07T15:00:00.000Z'

      it('casos de fuso do épico §11', async () => {
        congelarRelogio(AGORA)
        const casos = {
          canceladoHoje0030: await treino({
            status: 'CANCELADO',
            inicio: new Date('2026-10-07T03:30:00.000Z'),
          }),
          agendadoHojeJaPassou: await treino({ inicio: new Date('2026-10-07T11:00:00.000Z') }),
          emAndamentoOntem: await treino({
            status: 'EM_ANDAMENTO',
            inicio: new Date('2026-10-06T15:00:00.000Z'),
          }),
          canceladoOntem2359: await treino({
            status: 'CANCELADO',
            inicio: new Date('2026-10-07T02:59:00.000Z'),
          }),
          agendadoOntem: await treino({ inicio: new Date('2026-10-06T15:00:00.000Z') }),
          finalizadoFuturo: await treino({
            status: 'FINALIZADO',
            inicio: new Date('2026-10-09T15:00:00.000Z'),
          }),
        }
        const atleta = await usuario()

        expect(await idsListados(atleta)).toEqual([
          casos.emAndamentoOntem.id,
          casos.canceladoHoje0030.id,
          casos.agendadoHojeJaPassou.id,
        ])
        expect(await idsListados(atleta, { periodo: 'PASSADOS' })).toEqual([
          casos.finalizadoFuturo.id,
          casos.canceladoOntem2359.id,
          casos.agendadoOntem.id,
        ])
      })

      it('cancelado de hoje às 08:00 aparece às 22:00 e some às 00:01 do dia seguinte', async () => {
        const cancelado = await treino({
          status: 'CANCELADO',
          inicio: new Date('2026-10-07T11:00:00.000Z'),
        })

        congelarRelogio('2026-10-08T01:00:00.000Z')
        expect(await idsListados('ATLETA')).toEqual([cancelado.id])

        congelarRelogio('2026-10-08T03:01:00.000Z')
        expect(await idsListados('ATLETA')).toEqual([])
      })
    })

    describe('filtros', () => {
      it('tipo, modalidade (RN19) e a combinação dos dois (critérios 3 e 4)', async () => {
        const treinoVolei = await treino()
        const jogoVolei = await jogo()
        const treinoFutsal = await treino({ timeId: timeFutsal.id })

        expect(await idsListados('ATLETA', { tipo: 'JOGO' })).toEqual([jogoVolei.id])
        expect((await idsListados('ATLETA', { tipo: 'TREINO' })).sort()).toEqual(
          [treinoVolei.id, treinoFutsal.id].sort(),
        )
        expect((await idsListados('ATLETA', { modalidadeId: volei.id })).sort()).toEqual(
          [treinoVolei.id, jogoVolei.id].sort(),
        )
        expect(await idsListados('ATLETA', { modalidadeId: volei.id, tipo: 'TREINO' })).toEqual([
          treinoVolei.id,
        ])
      })

      it('modalidade do adversário não conta: só a do time (RN19)', async () => {
        await jogo()
        expect(await idsListados('ATLETA', { modalidadeId: futsal.id })).toEqual([])
      })

      it('timeId', async () => {
        const doFutsal = await treino({ timeId: timeFutsal.id })
        await treino()
        expect(await idsListados('ATLETA', { timeId: timeFutsal.id })).toEqual([doFutsal.id])
      })

      it('status múltiplo', async () => {
        const agendado = await treino({ inicio: emDias(1) })
        const cancelado = await treino({ inicio: emDias(2), status: 'CANCELADO' })
        await treino({ inicio: emDias(3), status: 'FINALIZADO' })

        expect(
          await idsListados('ATLETA', {
            periodo: 'TODOS',
            status: 'AGENDADO,CANCELADO',
            ordem: 'asc',
          }),
        ).toEqual([agendado.id, cancelado.id])
      })

      it('resultado=PENDENTE&tipo=JOGO&status=FINALIZADO&periodo=TODOS → jogos finalizados sem resultado', async () => {
        const pendente = await jogo({ status: 'FINALIZADO', inicio: emDias(-1) })
        const registrado = await jogo({
          status: 'FINALIZADO',
          inicio: emDias(-2),
          placarTime: 3,
          placarAdversario: 1,
          resultado: 'VITORIA',
        })
        await jogo({ status: 'AGENDADO' })
        await treino({ status: 'FINALIZADO', inicio: emDias(-1) })

        const filtro = { tipo: 'JOGO', status: 'FINALIZADO', periodo: 'TODOS' }
        expect(await idsListados('DIRETOR', { ...filtro, resultado: 'PENDENTE' })).toEqual([
          pendente.id,
        ])
        expect(await idsListados('DIRETOR', { periodo: 'TODOS', resultado: 'PENDENTE' })).toEqual([
          pendente.id,
        ])
        expect(await idsListados('DIRETOR', { ...filtro, resultado: 'REGISTRADO' })).toEqual([
          registrado.id,
        ])
      })

      it('serieId e aPartirDe ("esta e seguintes")', async () => {
        const serie = await criarSerie({ atleticaId, timeId: time.id, criadoPorId: autorId })
        const primeira = await treino({ serieId: serie.id, inicio: emDias(1) })
        const segunda = await treino({ serieId: serie.id, inicio: emDias(2) })
        await treino({ inicio: emDias(3) })

        expect(await idsListados('ATLETA', { serieId: serie.id })).toEqual([
          primeira.id,
          segunda.id,
        ])
        expect(
          await idsListados('ATLETA', {
            serieId: serie.id,
            aPartirDe: segunda.inicio.toISOString(),
          }),
        ).toEqual([segunda.id])
      })

      it('confirmadoPorMim usa sempre o usuário do token (critério 22)', async () => {
        const eu = await usuario()
        const outro = await usuario()
        const vou = await treino({ participantes: [{ usuarioId: eu.id, confirmado: true }] })
        await treino({ participantes: [{ usuarioId: eu.id, confirmado: false }] })
        await treino({ participantes: [{ usuarioId: outro.id, confirmado: true }] })

        expect(await idsListados(eu, { confirmadoPorMim: true })).toEqual([vou.id])
      })
    })

    describe('times e modalidades inativos', () => {
      let deTimeInativo: Evento
      let deModalidadeInativa: Evento
      let ativo: Evento

      beforeEach(async () => {
        const inativo = await criarTime({ atleticaId, modalidadeId: volei.id, ativo: false })
        const modalidadeInativa = await criarModalidade({ ativa: false })
        const timeDaInativa = await criarTime({ atleticaId, modalidadeId: modalidadeInativa.id })
        deTimeInativo = await treino({ timeId: inativo.id, inicio: emDias(1) })
        deModalidadeInativa = await treino({ timeId: timeDaInativa.id, inicio: emDias(2) })
        ativo = await treino({ inicio: emDias(3) })
      })

      it('ATLETA não vê, mesmo com incluirInativos=true (critério 18)', async () => {
        expect(await idsListados('ATLETA', { incluirInativos: true })).toEqual([ativo.id])
      })

      it('DIRETOR vê só com incluirInativos=true', async () => {
        expect(await idsListados('DIRETOR')).toEqual([ativo.id])
        expect(await idsListados('DIRETOR', { incluirInativos: true })).toEqual([
          deTimeInativo.id,
          deModalidadeInativa.id,
          ativo.id,
        ])
      })

      it('o detalhe continua acessível', async () => {
        expect((await (await como()).detalhar(deTimeInativo.id)).status).toBe(200)
      })
    })

    it('souMembro e minhaParticipacao do usuário do token', async () => {
      const eu = await usuario()
      await adicionarMembro(time, eu)
      const respondido = await treino({
        inicio: emDias(1),
        participantes: [{ usuarioId: eu.id, confirmado: true }],
      })
      const semResposta = await treino({ inicio: emDias(2) })
      const deOutroTime = await treino({ timeId: timeFutsal.id, inicio: emDias(3) })

      const { items } = listaEventosSchema.parse((await (await como(eu)).listar()).body)
      const porId = new Map(items.map((item) => [item.id, item]))
      expect(porId.get(respondido.id)).toMatchObject({
        souMembro: true,
        minhaParticipacao: { confirmado: true, respondidoEm: expect.any(String) as string },
      })
      expect(porId.get(semResposta.id)).toMatchObject({ souMembro: true, minhaParticipacao: null })
      expect(porId.get(deOutroTime.id)).toMatchObject({ souMembro: false, minhaParticipacao: null })
    })

    describe('paginação', () => {
      beforeEach(async () => {
        await prismaTeste.evento.createMany({
          data: Array.from({ length: 45 }, (_, i) => ({
            atleticaId,
            tipo: 'TREINO' as const,
            timeId: time.id,
            criadoPorId: autorId,
            local: `Quadra ${i}`,
            inicio: new Date(Date.now() + (i + 1) * 60 * 60 * 1000),
          })),
        })
      })

      it('45 próximos → páginas de 20, 20 e 5 com total = 45, sem repetir (critério 10)', async () => {
        const cliente = await como()
        const paginas = await Promise.all(
          [1, 2, 3].map(async (page) =>
            listaEventosSchema.parse((await cliente.listar({ page })).body),
          ),
        )

        expect(paginas.map(({ items }) => items.length)).toEqual([20, 20, 5])
        expect(paginas.map(({ total, page }) => [page, total])).toEqual([
          [1, 45],
          [2, 45],
          [3, 45],
        ])
        expect(new Set(paginas.flatMap(({ items }) => items.map(({ id }) => id))).size).toBe(45)
      })

      it('limit=50 é aceito', async () => {
        const resposta = await (await como()).listar({ limit: 50 })
        expect(resposta.status).toBe(200)
        expect(listaEventosSchema.parse(resposta.body).items).toHaveLength(45)
      })

      it('sem N+1: mesmo número de consultas para 1 e 20 itens', async () => {
        const eu = await usuario()
        await adicionarMembro(time, eu)
        const cliente = await como(eu)

        const comUm = await contarConsultas(() => cliente.listar({ limit: 1 }).expect(200))
        const comVinte = await contarConsultas(() => cliente.listar({ limit: 20 }).expect(200))
        expect(comVinte).toBe(comUm)
      })
    })
  })

  describe('GET /eventos/:id', () => {
    it('404 para inexistente, excluído e de outra atlética (critério 15)', async () => {
      const excluido = await treino({ excluidoEm: new Date() })
      const outra = await criarAtletica()
      const alheio = await criarTreino({ atleticaId: outra.id })
      const cliente = await como()

      for (const id of [ID_INEXISTENTE, excluido.id, alheio.id]) {
        const resposta = await cliente.detalhar(id)
        expect(resposta.status).toBe(404)
        expect(erro(resposta).code).toBe('NOT_FOUND')
      }
    })

    it('membro que respondeu "Vou": contagem do elenco atual, Quem vai e podeResponder (critérios 11, 12 e 14)', async () => {
      const eu = await usuario()
      const capita = await criarUsuario({ atleticaId, nome: 'Ana Souza' })
      await prismaTeste.usuario.update({
        where: { id: capita.id },
        data: { fotoKey: `usuarios/${capita.id}/perfil/foto.jpg` },
      })
      const recusou = await usuario()
      const semResposta = await usuario()
      const exMembro = await usuario()
      const naoMembro = await usuario()
      for (const membro of [eu, capita, recusou, semResposta]) await adicionarMembro(time, membro)
      await adicionarMembro(time, exMembro, { saidaEm: new Date() })
      await prismaTeste.time.update({ where: { id: time.id }, data: { capitaoId: capita.id } })

      const evento = await jogo({ observacoes: 'Chegar cedo' })
      await criarParticipacoes(evento, [
        { usuarioId: eu.id, confirmado: true },
        { usuarioId: capita.id, confirmado: true },
        { usuarioId: recusou.id, confirmado: false },
        { usuarioId: exMembro.id, confirmado: true },
        { usuarioId: naoMembro.id, confirmado: true },
      ])

      const resposta = await (await como(eu)).detalhar(evento.id)
      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const detalhe = eventoDetalheSchema.parse(resposta.body)
      expect(detalhe).toMatchObject({
        id: evento.id,
        observacoes: 'Chegar cedo',
        serie: null,
        contagem: { confirmados: 2, recusados: 1, semResposta: 1, elenco: 4 },
        souMembro: true,
        minhaParticipacao: { confirmado: true },
        podeResponder: true,
        motivoBloqueioResposta: null,
      })
      expect(detalhe.confirmados).toEqual([
        {
          id: capita.id,
          nome: 'Ana Souza',
          fotoUrl: `https://imagens.teste.local/usuarios/${capita.id}/perfil/foto.jpg`,
          capitao: true,
        },
        { id: eu.id, nome: eu.nome, fotoUrl: null, capitao: false },
      ])
    })

    it('usuário excluído aparece em "Quem vai" como "Usuário excluído" sem foto', async () => {
      const eu = await usuario()
      const excluido = await usuario()
      for (const membro of [eu, excluido]) await adicionarMembro(time, membro)
      await prismaTeste.usuario.update({
        where: { id: excluido.id },
        data: { fotoKey: 'usuarios/x/perfil/f.jpg', excluidoEm: new Date() },
      })
      const evento = await treino()
      await criarParticipacoes(evento, [{ usuarioId: excluido.id, confirmado: true }])

      const detalhe = eventoDetalheSchema.parse((await (await como(eu)).detalhar(evento.id)).body)
      expect(detalhe.confirmados).toEqual([
        { id: excluido.id, nome: 'Usuário excluído', fotoUrl: null, capitao: false },
      ])
    })

    it('cancelado: podeResponder = false e EVENTO_CANCELADO (critério 13)', async () => {
      const eu = await usuario()
      await adicionarMembro(time, eu)
      const evento = await treino({ status: 'CANCELADO' })

      const detalhe = eventoDetalheSchema.parse((await (await como(eu)).detalhar(evento.id)).body)
      expect(detalhe).toMatchObject({
        status: 'CANCELADO',
        podeResponder: false,
        motivoBloqueioResposta: 'EVENTO_CANCELADO',
      })
    })

    it('não membro: NAO_MEMBRO_DO_ELENCO; evento de série traz a série', async () => {
      const serie = await criarSerie({ atleticaId, timeId: time.id, criadoPorId: autorId })
      const evento = await treino({ serieId: serie.id })

      const detalhe = eventoDetalheSchema.parse((await (await como()).detalhar(evento.id)).body)
      expect(detalhe).toMatchObject({
        serieId: serie.id,
        serie: {
          id: serie.id,
          diasSemana: [1, 3],
          horario: '18:30',
          dataInicio: '2026-10-05',
          dataFim: '2027-04-05',
        },
        contagem: { confirmados: 0, recusados: 0, semResposta: 0, elenco: 0 },
        confirmados: [],
        souMembro: false,
        minhaParticipacao: null,
        podeResponder: false,
        motivoBloqueioResposta: 'NAO_MEMBRO_DO_ELENCO',
      })
    })

    it('evento já iniciado: EVENTO_JA_INICIADO', async () => {
      const eu = await usuario()
      await adicionarMembro(time, eu)
      const evento = await treino({ inicio: new Date(Date.now() - 60_000) })

      const detalhe = eventoDetalheSchema.parse((await (await como(eu)).detalhar(evento.id)).body)
      expect(detalhe.motivoBloqueioResposta).toBe('EVENTO_JA_INICIADO')
    })
  })
})
