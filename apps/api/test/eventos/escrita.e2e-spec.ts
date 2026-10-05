import {
  chaveDiaLocal,
  eventoCanceladoDtoSchema,
  eventoDtoSchema,
  formatarData,
  formatarHora,
  localParaUtc,
  tituloDoEvento,
  type Papel,
} from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import type { Evento, Time } from '../../src/generated/prisma/client'
import { TransacaoService } from '../../src/infra/eventos/apos-commit'
import { ContextoAtletica } from '../../src/infra/contexto/contexto-atletica.service'
import { AuditoriaService } from '../../src/modules/auditoria/auditoria.service'
import { EventosService } from '../../src/modules/eventos/eventos.service'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarEvento, criarJogo, criarParticipacoes, criarTreino } from '../fabricas/eventos'
import { criarModalidade } from '../fabricas/modalidades'
import { criarAtleticaAdversaria, criarTime, criarTimeAdversario } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/eventos'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const DIA_MS = 24 * 60 * 60 * 1000
const AMANHA = new Date(Date.now() + DIA_MS).toISOString()
const DEPOIS_DE_AMANHA = new Date(Date.now() + 2 * DIA_MS).toISOString()
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

describe('/eventos — escrita (#70)', () => {
  let contexto: AppDeTeste
  let eventos: EspiaoEventos
  let atleticaId: string
  let voleiId: string
  let time: Time
  let adversario: Time

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica()).id
    voleiId = (await criarModalidade({ nome: 'Vôlei', icone: 'volleyball' })).id
    time = await criarTime({ atleticaId, modalidadeId: voleiId, nome: 'Vôlei Masculino' })
    const medicina = await criarAtleticaAdversaria({ nome: 'Atlética Medicina', sigla: 'AAMED' })
    adversario = await criarTimeAdversario({ atleticaId: medicina.id, modalidadeId: voleiId })
    eventos = espiarEventos(contexto.app)
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  const usuario = (papel: Papel = 'ATLETA') => criarUsuario({ papel, atleticaId })

  async function como(papel: Papel | UsuarioCriado) {
    const alvo = typeof papel === 'string' ? await usuario(papel) : papel
    const auth = `Bearer ${await tokenPara(alvo)}`
    const http = contexto.http
    return {
      post: (corpo: object) => request(http).post(ROTA).set('Authorization', auth).send(corpo),
      patch: (id: string, corpo: object) =>
        request(http).patch(`${ROTA}/${id}`).set('Authorization', auth).send(corpo),
      cancelar: (id: string, corpo?: object) => {
        const req = request(http).post(`${ROTA}/${id}/cancelar`).set('Authorization', auth)
        return corpo ? req.send(corpo) : req
      },
      delete: (id: string) => request(http).delete(`${ROTA}/${id}`).set('Authorization', auth),
    }
  }

  const registros = () =>
    prismaTeste.registroAuditoria.findMany({
      where: { entidade: 'Evento' },
      orderBy: { criadoEm: 'asc' },
    })

  const treino = (dados: object = {}) => ({
    tipo: 'TREINO',
    timeId: time.id,
    inicio: AMANHA,
    local: 'Ginásio Castelinho',
    ...dados,
  })
  const jogo = (dados: object = {}) =>
    treino({ tipo: 'JOGO', timeAdversarioId: adversario.id, ...dados })

  const novoTreino = (dados: Partial<Evento> = {}) =>
    criarTreino({ atleticaId, timeId: time.id, inicio: new Date(AMANHA), ...dados })
  const novoJogo = (dados: Partial<Evento> = {}) =>
    criarJogo({
      atleticaId,
      timeId: time.id,
      timeAdversarioId: adversario.id,
      inicio: new Date(AMANHA),
      ...dados,
    })

  async function emitidos() {
    await aguardarOuvintes()
    return eventos.emitidos().filter(({ nome }) => nome.startsWith('evento.'))
  }

  describe('POST /eventos', () => {
    it('DIRETOR cria TREINO: 201 AGENDADO, auditoria e evento.criado após o commit (critério 1)', async () => {
      const diretor = await usuario('DIRETOR')
      const resposta = await (await como(diretor)).post(treino({ observacoes: 'Levar água' }))

      expect(resposta.status).toBe(201)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const evento = eventoDtoSchema.parse(resposta.body)
      expect(evento).toMatchObject({
        tipo: 'TREINO',
        status: 'AGENDADO',
        inicio: AMANHA,
        local: 'Ginásio Castelinho',
        observacoes: 'Levar água',
        serieId: null,
        time: { id: time.id, nome: 'Vôlei Masculino' },
        modalidade: { id: voleiId, nome: 'Vôlei', icone: 'volleyball' },
        timeAdversario: null,
        placarTime: null,
        resultado: null,
      })
      await expect(
        prismaTeste.evento.findUniqueOrThrow({ where: { id: evento.id } }),
      ).resolves.toMatchObject({ atleticaId, criadoPorId: diretor.id, excluidoEm: null })

      const [registro, ...outros] = await registros()
      expect(outros).toHaveLength(0)
      expect(registro).toMatchObject({
        acao: 'EVENTO_CRIADO',
        entidadeId: evento.id,
        usuarioId: diretor.id,
        atleticaId,
        dados: {
          antes: null,
          depois: {
            tipo: 'TREINO',
            status: 'AGENDADO',
            timeId: time.id,
            timeAdversarioId: null,
            inicio: AMANHA,
            local: 'Ginásio Castelinho',
            observacoes: 'Levar água',
          },
        },
      })
      await expect(emitidos()).resolves.toEqual([
        {
          nome: 'evento.criado',
          payload: { atleticaId, eventoId: evento.id, timeId: time.id, autorId: diretor.id },
        },
      ])
    })

    it('JOGO com adversário da mesma modalidade: "<time> × <atlética>" (critério 2)', async () => {
      const resposta = await (await como('DIRETOR')).post(jogo())

      expect(resposta.status).toBe(201)
      const evento = eventoDtoSchema.parse(resposta.body)
      expect(evento.timeAdversario).toEqual({
        id: adversario.id,
        nome: adversario.nome,
        atletica: { id: adversario.atleticaId, nome: 'Atlética Medicina', sigla: 'AAMED' },
      })
      expect(tituloDoEvento(evento)).toBe('Vôlei Masculino × Atlética Medicina')
    })

    it('JOGO sem adversário → 400 em timeAdversarioId (critério 3)', async () => {
      const resposta = await (await como('DIRETOR')).post(jogo({ timeAdversarioId: undefined }))
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      expect(erro(resposta).details[0]?.field).toBe('timeAdversarioId')
    })

    it('adversário de outra modalidade → 422 MODALIDADES_DIFERENTES sem gravar (critério 4)', async () => {
      const futsal = await criarModalidade({ nome: 'Futsal' })
      const timeFutsal = await criarTime({ atleticaId, modalidadeId: futsal.id })
      const resposta = await (await como('DIRETOR')).post(jogo({ timeId: timeFutsal.id }))

      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('MODALIDADES_DIFERENTES')
      await expect(prismaTeste.evento.count()).resolves.toBe(0)
      await expect(registros()).resolves.toHaveLength(0)
      await expect(emitidos()).resolves.toEqual([])
    })

    it('TREINO com adversário → 400 (critério 5)', async () => {
      const resposta = await (
        await como('DIRETOR')
      ).post(treino({ timeAdversarioId: adversario.id }))
      expect(resposta.status).toBe(400)
      expect(erro(resposta).details[0]?.field).toBe('timeAdversarioId')
    })

    it.each([
      ['time da própria atlética', 'proprio'],
      ['inativo', 'inativo'],
      ['igual ao timeId', 'igual'],
      ['inexistente', 'inexistente'],
    ])('adversário %s → 422 ADVERSARIO_INVALIDO (critério 6)', async (_caso, alvo) => {
      const ids: Record<string, () => Promise<string>> = {
        proprio: async () => (await criarTime({ atleticaId, modalidadeId: voleiId })).id,
        inativo: async () =>
          (await criarTimeAdversario({ modalidadeId: voleiId, ativo: false })).id,
        igual: () => Promise.resolve(time.id),
        inexistente: () => Promise.resolve(ID_INEXISTENTE),
      }
      const resposta = await (
        await como('DIRETOR')
      ).post(jogo({ timeAdversarioId: await ids[alvo]!() }))
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('ADVERSARIO_INVALIDO')
      expect(erro(resposta).details[0]?.field).toBe('timeAdversarioId')
    })

    it.each([
      ['inativo', 'TIME_INATIVO'],
      ['de modalidade inativa', 'MODALIDADE_INATIVA'],
      ['de outra atlética que usa o app', 'TIME_INVALIDO'],
      ['adversário', 'TIME_INVALIDO'],
      ['inexistente', 'TIME_INVALIDO'],
    ])('timeId %s → 422 %s (critério 7)', async (caso, codigo) => {
      const ids: Record<string, () => Promise<string>> = {
        inativo: async () => (await criarTime({ atleticaId, ativo: false })).id,
        'de modalidade inativa': async () => {
          const xadrez = await criarModalidade({ ativa: false })
          return (await criarTime({ atleticaId, modalidadeId: xadrez.id })).id
        },
        'de outra atlética que usa o app': async () =>
          (await criarTime({ atleticaId: (await criarAtletica()).id })).id,
        adversário: () => Promise.resolve(adversario.id),
        inexistente: () => Promise.resolve(ID_INEXISTENTE),
      }
      const resposta = await (await como('DIRETOR')).post(treino({ timeId: await ids[caso]!() }))
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe(codigo)
      expect(erro(resposta).details[0]?.field).toBe('timeId')
      await expect(prismaTeste.evento.count()).resolves.toBe(0)
    })

    it.each([
      ['atleticaId', () => atleticaId],
      ['status', () => 'FINALIZADO'],
      ['placarTime', () => 3],
      ['resultado', () => 'VITORIA'],
      ['excluidoEm', () => AMANHA],
      ['criadoPorId', () => ID_INEXISTENTE],
    ])('%s no corpo → 400 (mass assignment)', async (campo, valor) => {
      const resposta = await (await como('DIRETOR')).post(jogo({ [campo]: valor() }))
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      await expect(prismaTeste.evento.count()).resolves.toBe(0)
    })

    it('limites: local 1 e 121 → 400; 2 e 120 → 201; observações 501 → 400', async () => {
      const api = await como('DIRETOR')
      for (const local of ['a', 'x'.repeat(121)]) {
        const resposta = await api.post(treino({ local }))
        expect(resposta.status).toBe(400)
        expect(erro(resposta).details[0]?.field).toBe('local')
      }
      for (const local of ['ab', 'x'.repeat(120)]) {
        expect((await api.post(treino({ local }))).status).toBe(201)
      }
      const observacoes = await api.post(treino({ observacoes: 'x'.repeat(501) }))
      expect(observacoes.status).toBe(400)
      expect(erro(observacoes).details[0]?.field).toBe('observacoes')
    })

    it('fuso: 22:00Z é 19:00 local; 23:30 local cai às 02:30Z do dia seguinte', async () => {
      const api = await como('DIRETOR')
      const dia = AMANHA.slice(0, 10)

      const noite = eventoDtoSchema.parse(
        (await api.post(treino({ inicio: `${dia}T22:00:00.000Z` }))).body,
      )
      expect(formatarHora(noite.inicio)).toBe('19:00')
      expect(formatarData(noite.inicio)).toBe(
        `${dia.slice(8)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`,
      )

      const tarde = localParaUtc(dia, '23:30').toISOString()
      const madrugada = eventoDtoSchema.parse((await api.post(treino({ inicio: tarde }))).body)
      expect(madrugada.inicio).toBe(tarde)
      expect(madrugada.inicio.slice(11, 16)).toBe('02:30')
      expect(madrugada.inicio.slice(0, 10)).not.toBe(dia)
      expect(chaveDiaLocal(madrugada.inicio)).toBe(dia)
      expect(formatarHora(madrugada.inicio)).toBe('23:30')
    })
  })

  describe('PATCH /eventos/:id', () => {
    it('AGENDADO: inicio e local → 200, auditoria só desses campos e um evento.alterado (critério 8)', async () => {
      const diretor = await usuario('DIRETOR')
      const evento = await novoJogo({ local: 'Ginásio', observacoes: 'Antes' })
      const resposta = await (
        await como(diretor)
      ).patch(evento.id, { inicio: DEPOIS_DE_AMANHA, local: 'Quadra', observacoes: 'Antes' })

      expect(resposta.status).toBe(200)
      expect(eventoDtoSchema.parse(resposta.body)).toMatchObject({
        inicio: DEPOIS_DE_AMANHA,
        local: 'Quadra',
        observacoes: 'Antes',
      })
      const [registro] = await registros()
      expect(registro).toMatchObject({
        acao: 'EVENTO_ALTERADO',
        entidadeId: evento.id,
        usuarioId: diretor.id,
        dados: {
          antes: { inicio: AMANHA, local: 'Ginásio' },
          depois: { inicio: DEPOIS_DE_AMANHA, local: 'Quadra' },
        },
      })
      await expect(emitidos()).resolves.toEqual([
        {
          nome: 'evento.alterado',
          payload: {
            atleticaId,
            eventoIds: [evento.id],
            timeId: time.id,
            campos: ['inicio', 'local'],
            autorId: diretor.id,
          },
        },
      ])
    })

    it.each([
      ['só inicio', { inicio: DEPOIS_DE_AMANHA }, ['inicio']],
      ['só local', { local: 'Quadra' }, ['local']],
    ])('%s → campos %j', async (_caso, corpo, campos) => {
      const evento = await novoTreino()
      expect((await (await como('DIRETOR')).patch(evento.id, corpo)).status).toBe(200)
      const [emitido] = await emitidos()
      expect(emitido?.payload).toMatchObject({ campos })
    })

    it('só observações → 200 com auditoria e sem evento.alterado (critério 9)', async () => {
      const evento = await novoTreino()
      const resposta = await (await como('DIRETOR')).patch(evento.id, { observacoes: 'Levar bola' })

      expect(resposta.status).toBe(200)
      await expect(registros()).resolves.toMatchObject([
        {
          acao: 'EVENTO_ALTERADO',
          dados: { antes: { observacoes: null }, depois: { observacoes: 'Levar bola' } },
        },
      ])
      await expect(emitidos()).resolves.toEqual([])
    })

    it('sem mudança (mesmo instante em outro formato) → 200 sem auditoria nem evento', async () => {
      const evento = await novoTreino({ local: 'Ginásio' })
      const resposta = await (
        await como('DIRETOR')
      ).patch(evento.id, { inicio: AMANHA.replace('Z', '+00:00'), local: ' Ginásio ' })

      expect(resposta.status).toBe(200)
      await expect(registros()).resolves.toHaveLength(0)
      await expect(emitidos()).resolves.toEqual([])
    })

    it('CANCELADO → 422 EVENTO_CANCELADO (critério 10)', async () => {
      const evento = await novoTreino({ status: 'CANCELADO' })
      const resposta = await (await como('DIRETOR')).patch(evento.id, { observacoes: 'x' })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('EVENTO_CANCELADO')
    })

    it('FINALIZADO: local → 422 EVENTO_FINALIZADO; só observações → 200 (critério 11)', async () => {
      const evento = await novoJogo({
        status: 'FINALIZADO',
        placarTime: 3,
        placarAdversario: 1,
        resultado: 'VITORIA',
      })
      const api = await como('DIRETOR')

      const local = await api.patch(evento.id, { local: 'Quadra' })
      expect(local.status).toBe(422)
      expect(erro(local).code).toBe('EVENTO_FINALIZADO')
      expect((await api.patch(evento.id, { observacoes: 'Grande jogo' })).status).toBe(200)
    })

    it('EM_ANDAMENTO aceita todos os campos editáveis', async () => {
      const evento = await novoTreino({ status: 'EM_ANDAMENTO' })
      const resposta = await (await como('DIRETOR')).patch(evento.id, { local: 'Quadra 2' })
      expect(resposta.status).toBe(200)
    })

    it('troca de timeId: com participação → 409; sem → 200 (critério 12)', async () => {
      const outro = await criarTime({ atleticaId, modalidadeId: voleiId })
      const comResposta = await novoTreino()
      await criarParticipacoes(comResposta, [
        { usuarioId: (await usuario()).id, confirmado: false },
      ])
      const semResposta = await novoTreino()
      const api = await como('DIRETOR')

      const bloqueado = await api.patch(comResposta.id, { timeId: outro.id })
      expect(bloqueado.status).toBe(409)
      expect(erro(bloqueado).code).toBe('EVENTO_COM_PARTICIPACOES')

      const trocado = await api.patch(semResposta.id, { timeId: outro.id })
      expect(trocado.status).toBe(200)
      expect(eventoDtoSchema.parse(trocado.body).time.id).toBe(outro.id)
      await expect(emitidos()).resolves.toEqual([])
    })

    it('JOGO: novo time de outra modalidade → 422 MODALIDADES_DIFERENTES', async () => {
      const futsal = await criarModalidade()
      const timeFutsal = await criarTime({ atleticaId, modalidadeId: futsal.id })
      const evento = await novoJogo()
      const resposta = await (await como('DIRETOR')).patch(evento.id, { timeId: timeFutsal.id })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('MODALIDADES_DIFERENTES')
    })

    it('JOGO: troca de adversário é validada; TREINO não aceita adversário', async () => {
      const jogoAgendado = await novoJogo()
      const treinoAgendado = await novoTreino()
      const outroAdversario = await criarTimeAdversario({ modalidadeId: voleiId })
      const proprio = await criarTime({ atleticaId, modalidadeId: voleiId })
      const api = await como('DIRETOR')

      const invalido = await api.patch(jogoAgendado.id, { timeAdversarioId: proprio.id })
      expect(invalido.status).toBe(422)
      expect(erro(invalido).code).toBe('ADVERSARIO_INVALIDO')

      const trocado = await api.patch(jogoAgendado.id, { timeAdversarioId: outroAdversario.id })
      expect(trocado.status).toBe(200)
      expect(eventoDtoSchema.parse(trocado.body).timeAdversario?.id).toBe(outroAdversario.id)

      const emTreino = await api.patch(treinoAgendado.id, { timeAdversarioId: outroAdversario.id })
      expect(emTreino.status).toBe(400)
      expect(erro(emTreino).details[0]?.field).toBe('timeAdversarioId')
    })

    it.each([
      {},
      { tipo: 'JOGO' },
      { status: 'CANCELADO' },
      { placarTime: 1 },
      { atleticaId: ID_INEXISTENTE },
    ])('corpo %j → 400', async (corpo) => {
      const evento = await novoTreino()
      const resposta = await (await como('DIRETOR')).patch(evento.id, corpo)
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
    })

    it('evento excluído, inexistente → 404; id malformado → 400', async () => {
      const excluido = await novoTreino({ excluidoEm: new Date() })
      const api = await como('DIRETOR')
      expect((await api.patch(excluido.id, { local: 'Quadra' })).status).toBe(404)
      expect((await api.patch(ID_INEXISTENTE, { local: 'Quadra' })).status).toBe(404)
      expect((await api.patch('abc', { local: 'Quadra' })).status).toBe(400)
    })
  })

  describe('POST /eventos/:id/cancelar', () => {
    it('AGENDADO → CANCELADO com auditoria e evento.cancelado (critério 13)', async () => {
      const diretor = await usuario('DIRETOR')
      const evento = await novoJogo()
      const resposta = await (await como(diretor)).cancelar(evento.id)

      expect(resposta.status).toBe(200)
      expect(eventoCanceladoDtoSchema.parse(resposta.body)).toEqual({
        eventoIds: [evento.id],
        status: 'CANCELADO',
      })
      await expect(
        prismaTeste.evento.findUniqueOrThrow({ where: { id: evento.id } }),
      ).resolves.toMatchObject({ status: 'CANCELADO', excluidoEm: null })
      await expect(registros()).resolves.toMatchObject([
        {
          acao: 'EVENTO_CANCELADO',
          entidadeId: evento.id,
          usuarioId: diretor.id,
          dados: { antes: { status: 'AGENDADO' }, depois: { status: 'CANCELADO' } },
        },
      ])
      await expect(emitidos()).resolves.toEqual([
        {
          nome: 'evento.cancelado',
          payload: { atleticaId, eventoIds: [evento.id], timeId: time.id, autorId: diretor.id },
        },
      ])
    })

    it('EM_ANDAMENTO também pode ser cancelado; corpo {} é aceito', async () => {
      const evento = await novoTreino({ status: 'EM_ANDAMENTO' })
      expect((await (await como('DIRETOR')).cancelar(evento.id, {})).status).toBe(200)
    })

    it.each([
      ['FINALIZADO', 'EVENTO_FINALIZADO'],
      ['CANCELADO', 'EVENTO_JA_CANCELADO'],
    ] as const)('%s → 422 %s, sem auditoria nem evento (critério 14)', async (status, codigo) => {
      const evento = await novoTreino({ status })
      const resposta = await (await como('DIRETOR')).cancelar(evento.id)
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe(codigo)
      await expect(registros()).resolves.toHaveLength(0)
      await expect(emitidos()).resolves.toEqual([])
    })

    it('campo no corpo → 400', async () => {
      const evento = await novoTreino()
      const resposta = await (await como('DIRETOR')).cancelar(evento.id, { escopo: 'ESTA' })
      expect(resposta.status).toBe(400)
    })

    it('EventosService.cancelar em lote: só os canceláveis da atlética, uma auditoria por evento', async () => {
      const diretor = await usuario('DIRETOR')
      const agendado = await novoTreino()
      const emAndamento = await novoTreino({ status: 'EM_ANDAMENTO' })
      const finalizado = await novoTreino({ status: 'FINALIZADO' })
      const excluido = await novoTreino({ excluidoEm: new Date() })
      const deOutra = await criarEvento({ atleticaId: (await criarAtletica()).id })
      const ids = [agendado, emAndamento, finalizado, excluido, deOutra].map(({ id }) => id)

      const cancelados = await contexto.app
        .get(ContextoAtletica)
        .executarComAtletica(atleticaId, () =>
          contexto.app
            .get(TransacaoService)
            .executar((tx) => contexto.app.get(EventosService).cancelar(tx, ids, diretor)),
        )

      expect(cancelados.sort()).toEqual([agendado.id, emAndamento.id].sort())
      const auditados = await registros()
      expect(auditados.map(({ entidadeId }) => entidadeId).sort()).toEqual(cancelados)
      expect(auditados.every(({ usuarioId }) => usuarioId === diretor.id)).toBe(true)
      expect(
        auditados.find(({ entidadeId }) => entidadeId === emAndamento.id)?.dados,
      ).toMatchObject({ antes: { status: 'EM_ANDAMENTO' } })
      await expect(
        prismaTeste.evento.findUniqueOrThrow({ where: { id: deOutra.id } }),
      ).resolves.toMatchObject({ status: 'AGENDADO' })
    })
  })

  describe('DELETE /eventos/:id', () => {
    it('PRESIDENTE exclui sem dependências: 204, excluidoEm e auditoria, sem evento (critério 15)', async () => {
      const presidente = await usuario('PRESIDENTE')
      const evento = await novoJogo({ local: 'Ginásio' })
      const resposta = await (await como(presidente)).delete(evento.id)

      expect(resposta.status).toBe(204)
      const linha = await prismaTeste.evento.findUniqueOrThrow({ where: { id: evento.id } })
      expect(linha.excluidoEm).toBeInstanceOf(Date)
      await expect(registros()).resolves.toMatchObject([
        {
          acao: 'EVENTO_EXCLUIDO',
          entidadeId: evento.id,
          usuarioId: presidente.id,
          dados: {
            antes: {
              tipo: 'JOGO',
              status: 'AGENDADO',
              timeId: time.id,
              timeAdversarioId: adversario.id,
              local: 'Ginásio',
            },
            depois: null,
          },
        },
      ])
      await expect(emitidos()).resolves.toEqual([])
      expect((await (await como('DIRETOR')).patch(evento.id, { local: 'Quadra' })).status).toBe(404)
      expect((await (await como(presidente)).delete(evento.id)).status).toBe(404)
    })

    it.each([
      ['uma resposta "Não vou"', 1, [{ field: 'participacoes', message: '1 resposta' }]],
      ['três respostas', 3, [{ field: 'participacoes', message: '3 respostas' }]],
    ])('com %s → 409 EVENTO_COM_DEPENDENCIAS (critério 16)', async (_caso, total, details) => {
      const atletas = await Promise.all(Array.from({ length: total }, () => usuario()))
      const evento = await criarTreino({
        atleticaId,
        participantes: atletas.map(({ id }) => ({ usuarioId: id, confirmado: false })),
      })

      const resposta = await (await como('PRESIDENTE')).delete(evento.id)
      expect(resposta.status).toBe(409)
      expect(erro(resposta)).toMatchObject({ code: 'EVENTO_COM_DEPENDENCIAS', details })
      await expect(
        prismaTeste.evento.findUniqueOrThrow({ where: { id: evento.id } }),
      ).resolves.toMatchObject({ excluidoEm: null })
      await expect(registros()).resolves.toHaveLength(0)
    })

    it('com resultado → 409 com details em resultado', async () => {
      const evento = await novoJogo({
        status: 'FINALIZADO',
        placarTime: 0,
        placarAdversario: 0,
        resultado: 'EMPATE',
      })
      const resposta = await (await como('PRESIDENTE')).delete(evento.id)
      expect(resposta.status).toBe(409)
      expect(erro(resposta).details).toEqual([
        { field: 'resultado', message: 'Resultado registrado.' },
      ])
    })

    it('DIRETOR → 403 (critério 17)', async () => {
      const evento = await novoTreino()
      const resposta = await (await como('DIRETOR')).delete(evento.id)
      expect(resposta.status).toBe(403)
      expect(erro(resposta).code).toBe('FORBIDDEN')
    })
  })

  describe('transação, autorização e escopo', () => {
    type Operacao = 'post' | 'patch' | 'cancelar' | 'delete'

    async function executar(operacao: Operacao, evento: Evento) {
      const api = await como(operacao === 'delete' ? 'PRESIDENTE' : 'DIRETOR')
      if (operacao === 'post') return api.post(treino())
      if (operacao === 'patch') return api.patch(evento.id, { local: 'Quadra' })
      if (operacao === 'cancelar') return api.cancelar(evento.id)
      return api.delete(evento.id)
    }

    it.each<[Operacao, 'registrar' | 'registrarVarios']>([
      ['post', 'registrar'],
      ['patch', 'registrar'],
      ['cancelar', 'registrarVarios'],
      ['delete', 'registrar'],
    ])('%s: erro depois da auditoria desfaz tudo e não emite eventos', async (operacao, metodo) => {
      const evento = await novoTreino()
      const antes = await prismaTeste.evento.findUniqueOrThrow({ where: { id: evento.id } })
      const auditoria = contexto.app.get(AuditoriaService)
      const original = auditoria[metodo].bind(auditoria) as (...args: unknown[]) => Promise<void>
      const espiao = jest
        .spyOn(auditoria, metodo)
        .mockImplementationOnce(async (...args: unknown[]) => {
          await original(...args)
          throw new Error('falha depois da auditoria')
        })

      const resposta = await executar(operacao, evento)
      espiao.mockRestore()

      expect(resposta.status).toBe(500)
      await expect(prismaTeste.evento.count()).resolves.toBe(1)
      await expect(
        prismaTeste.evento.findUniqueOrThrow({ where: { id: evento.id } }),
      ).resolves.toEqual(antes)
      await expect(registros()).resolves.toHaveLength(0)
      await expect(emitidos()).resolves.toEqual([])
    })

    it('ATLETA → 403 em POST, PATCH e cancelar (critério 18)', async () => {
      const evento = await novoTreino()
      const api = await como('ATLETA')
      const respostas = [
        await api.post(treino()),
        await api.patch(evento.id, { local: 'Quadra' }),
        await api.cancelar(evento.id),
        await api.delete(evento.id),
      ]
      expect(respostas.map(({ status }) => status)).toEqual([403, 403, 403, 403])
      expect(respostas.every((resposta) => erro(resposta).code === 'FORBIDDEN')).toBe(true)
    })

    it('sem token → 401 UNAUTHENTICATED em todas as rotas (critério 18)', async () => {
      const evento = await novoTreino()
      const http = contexto.http
      const respostas = [
        await request(http).post(ROTA).send(treino()),
        await request(http).patch(`${ROTA}/${evento.id}`).send({ local: 'Quadra' }),
        await request(http).post(`${ROTA}/${evento.id}/cancelar`),
        await request(http).delete(`${ROTA}/${evento.id}`),
      ]
      for (const resposta of respostas) {
        expect(resposta.status).toBe(401)
        expect(erro(resposta).code).toBe('UNAUTHENTICATED')
      }
    })

    it('evento de outra atlética → 404 em PATCH, cancelar e DELETE (critério 19)', async () => {
      const alheio = await criarEvento({ atleticaId: (await criarAtletica()).id })
      const diretor = await como('DIRETOR')
      const respostas = [
        await diretor.patch(alheio.id, { local: 'Quadra' }),
        await diretor.cancelar(alheio.id),
        await (await como('PRESIDENTE')).delete(alheio.id),
      ]
      expect(respostas.map(({ status }) => status)).toEqual([404, 404, 404])
      expect(respostas.every((resposta) => erro(resposta).code === 'NOT_FOUND')).toBe(true)
      await expect(
        prismaTeste.evento.findUniqueOrThrow({ where: { id: alheio.id } }),
      ).resolves.toEqual(alheio)
    })
  })

  describe('banco (#43)', () => {
    it('CHECK evento_tipo_coerente: TREINO com adversário via Prisma cru falha', async () => {
      await expect(novoTreino({ timeAdversarioId: adversario.id })).rejects.toThrow(
        /evento_tipo_coerente/,
      )
    })

    it('índices de Evento existem', async () => {
      const indices = await prismaTeste.$queryRaw<{ indexdef: string }[]>`
        SELECT indexdef FROM pg_indexes WHERE tablename = 'Evento'`
      const colunas = indices.map(({ indexdef }) => /\((.*)\)/.exec(indexdef)?.[1])
      expect(colunas).toEqual(
        expect.arrayContaining([
          '"atleticaId", inicio',
          '"atleticaId", status, inicio',
          '"atleticaId", tipo, inicio',
          '"timeId", inicio',
          '"timeAdversarioId"',
          '"serieId", inicio',
        ]),
      )
    })
  })
})
