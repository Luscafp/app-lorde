import { listaPresencaDtoSchema, type Papel } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import type { Evento, Time } from '../../src/generated/prisma/client'
import { AuditoriaService } from '../../src/modules/auditoria/auditoria.service'
import { espiarEventos, type EspiaoEventos } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarEvento, criarTreino, type DadosEvento } from '../fabricas/eventos'
import { adicionarMembro, criarTime } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/eventos'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const HORA_MS = 60 * 60 * 1000
const INICIO = new Date(Date.now() - 2 * HORA_MS)
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro
const lista = (resposta: { body: unknown }) => listaPresencaDtoSchema.parse(resposta.body)
const presentes = (resposta: { body: unknown }) =>
  lista(resposta)
    .itens.filter(({ presente }) => presente)
    .map(({ usuarioId }) => usuarioId)

describe('/eventos/:id/presencas (#84)', () => {
  let contexto: AppDeTeste
  let espiao: EspiaoEventos
  let atleticaId: string
  let time: Time
  let diretor: UsuarioCriado

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    espiao = espiarEventos(contexto.app)
    atleticaId = (await criarAtletica()).id
    time = await criarTime({ atleticaId })
    diretor = await criarUsuario({ papel: 'DIRETOR', atleticaId })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  async function membro(nome: string, vinculo: { entradaEm?: Date; saidaEm?: Date } = {}) {
    const usuario = await criarUsuario({ atleticaId, nome })
    await adicionarMembro(time, usuario, {
      entradaEm: new Date(INICIO.getTime() - HORA_MS),
      ...vinculo,
    })
    return usuario
  }

  async function como(usuario: UsuarioCriado | Papel = diretor) {
    const autor =
      typeof usuario === 'string' ? await criarUsuario({ papel: usuario, atleticaId }) : usuario
    const auth = `Bearer ${await tokenPara(autor)}`
    return {
      listar: (id: string) =>
        request(contexto.http).get(`${ROTA}/${id}/presencas`).set('Authorization', auth),
      registrar: (id: string, corpo: unknown) =>
        request(contexto.http)
          .put(`${ROTA}/${id}/presencas`)
          .set('Authorization', auth)
          .send(corpo as object),
      excluir: (id: string) =>
        request(contexto.http).delete(`${ROTA}/${id}`).set('Authorization', auth),
    }
  }

  const treino = (dados: Partial<DadosEvento> = {}) =>
    criarTreino({ atleticaId, timeId: time.id, inicio: INICIO, status: 'EM_ANDAMENTO', ...dados })

  const linhas = (evento: Evento) =>
    prismaTeste.participacao.findMany({ where: { eventoId: evento.id } })

  const registros = () =>
    prismaTeste.registroAuditoria.findMany({
      where: { entidade: 'Participacao' },
      orderBy: { criadoEm: 'asc' },
    })

  /** 5 membros, 3 confirmados (critério 1 do épico). */
  async function cenarioCincoMembros() {
    const [ana, bia, caio, davi, eva] = await Promise.all([
      membro('Ana'),
      membro('Bia'),
      membro('Caio'),
      membro('Davi'),
      membro('Eva'),
    ])
    const evento = await treino({
      participantes: [
        { usuarioId: ana.id, confirmado: true },
        { usuarioId: bia.id, confirmado: true },
        { usuarioId: caio.id, confirmado: true },
        { usuarioId: davi.id, confirmado: false },
      ],
    })
    return { evento, ana, bia, caio, davi, eva }
  }

  describe('GET', () => {
    it('primeira abertura: elenco com os confirmados marcados e a resposta de cada um (critério 1)', async () => {
      const { evento, ana, bia, caio } = await cenarioCincoMembros()

      const resposta = await (await como()).listar(evento.id)

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      expect(lista(resposta)).toMatchObject({
        eventoId: evento.id,
        status: 'EM_ANDAMENTO',
        registrada: false,
        registradaEm: null,
      })
      expect(
        lista(resposta).itens.map(({ nome, resposta: r, presente }) => [nome, r, presente]),
      ).toEqual([
        ['Ana', 'CONFIRMOU', true],
        ['Bia', 'CONFIRMOU', true],
        ['Caio', 'CONFIRMOU', true],
        ['Davi', 'RECUSOU', false],
        ['Eva', 'SEM_RESPOSTA', false],
      ])
      expect(presentes(resposta)).toEqual([ana.id, bia.id, caio.id])
    })

    it('elenco do evento: entrou depois do início ou saiu antes ficam de fora (critério 8)', async () => {
      const antes = new Date(INICIO.getTime() - 30 * 60 * 1000)
      const depois = new Date(INICIO.getTime() + 30 * 60 * 1000)
      await membro('Ficou')
      await membro('Saiu depois', { saidaEm: depois })
      await membro('Entrou depois', { entradaEm: depois })
      await membro('Saiu antes', { saidaEm: antes })
      await membro('Entrou no início', { entradaEm: INICIO })
      const evento = await treino()

      const resposta = await (await como()).listar(evento.id)

      expect(lista(resposta).itens.map(({ nome }) => nome)).toEqual([
        'Entrou no início',
        'Ficou',
        'Saiu depois',
      ])
    })

    it('membro anonimizado aparece como "Usuário excluído", sem foto, e pode ser marcado', async () => {
      const anonimo = await membro('Zeca')
      await prismaTeste.usuario.update({
        where: { id: anonimo.id },
        data: { fotoKey: 'usuarios/x/perfil/f.jpg', excluidoEm: new Date() },
      })
      const evento = await treino()
      const api = await como()

      const item = lista(await api.listar(evento.id)).itens[0]
      expect(item).toEqual({
        usuarioId: anonimo.id,
        nome: 'Usuário excluído',
        fotoUrl: null,
        resposta: 'SEM_RESPOSTA',
        presente: false,
      })

      const salva = await api.registrar(evento.id, { presentes: [anonimo.id] })
      expect(salva.status).toBe(200)
      expect(presentes(salva)).toEqual([anonimo.id])
    })
  })

  describe('PUT', () => {
    it('desmarca um confirmado e marca quem não respondeu: substitui a chamada inteira (critérios 2 e 3)', async () => {
      const { evento, ana, bia, caio, davi, eva } = await cenarioCincoMembros()
      const api = await como()

      const resposta = await api.registrar(evento.id, { presentes: [ana.id, bia.id, eva.id] })

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const salva = lista(resposta)
      expect(salva.registrada).toBe(true)
      expect(Math.abs(Date.parse(salva.registradaEm ?? '') - Date.now())).toBeLessThan(10_000)
      expect(presentes(resposta)).toEqual([ana.id, bia.id, eva.id])

      const gravadas = await linhas(evento)
      expect(gravadas).toHaveLength(5)
      const porUsuario = new Map(gravadas.map((linha) => [linha.usuarioId, linha]))
      expect(porUsuario.get(caio.id)).toMatchObject({ confirmado: true, presente: false })
      expect(porUsuario.get(davi.id)).toMatchObject({ confirmado: false, presente: false })
      expect(porUsuario.get(eva.id)).toMatchObject({
        confirmado: null,
        respondidoEm: null,
        presente: true,
      })
      for (const linha of gravadas) {
        expect(linha.presencaRegistradaEm?.toISOString()).toBe(salva.registradaEm)
        expect(linha.presencaRegistradaPorId).toBe(diretor.id)
      }

      const reaberta = await api.listar(evento.id)
      expect(presentes(reaberta)).toEqual([ana.id, bia.id, eva.id])
      expect(lista(reaberta).registradaEm).toBe(salva.registradaEm)
    })

    it('auditoria PRESENCAS_REGISTRADAS a cada correção, sem evento de domínio (critério 4)', async () => {
      const { evento, ana, bia, eva } = await cenarioCincoMembros()
      const api = await como()

      await api.registrar(evento.id, { presentes: [ana.id] }).expect(200)
      await api.registrar(evento.id, { presentes: [eva.id, bia.id] }).expect(200)

      const [primeiro, correcao, ...outros] = await registros()
      expect(outros).toHaveLength(0)
      expect(primeiro).toMatchObject({
        acao: 'PRESENCAS_REGISTRADAS',
        entidade: 'Participacao',
        entidadeId: evento.id,
        usuarioId: diretor.id,
        dados: { antes: { presentes: [] }, depois: { presentes: [ana.id] } },
      })
      expect(correcao).toMatchObject({
        dados: {
          antes: { presentes: [ana.id] },
          depois: { presentes: [bia.id, eva.id].sort() },
        },
      })
      expect(espiao.emitidos()).toEqual([])
    })

    it('mesma lista de novo: 200 sem alterar presencaRegistradaEm nem auditar', async () => {
      const { evento, ana, bia } = await cenarioCincoMembros()
      const api = await como()
      const primeira = lista(await api.registrar(evento.id, { presentes: [ana.id, bia.id] }))
      const antes = await linhas(evento)

      const segunda = await api.registrar(evento.id, { presentes: [bia.id, ana.id] })

      expect(segunda.status).toBe(200)
      expect(lista(segunda).registradaEm).toBe(primeira.registradaEm)
      await expect(linhas(evento)).resolves.toEqual(antes)
      await expect(registros()).resolves.toHaveLength(1)
    })

    it('FINALIZADO aceita; jogo também', async () => {
      const ana = await membro('Ana')
      const evento = await criarEvento({
        atleticaId,
        tipo: 'JOGO',
        timeId: time.id,
        inicio: INICIO,
        status: 'FINALIZADO',
      })
      const resposta = await (await como()).registrar(evento.id, { presentes: [ana.id] })
      expect(resposta.status).toBe(200)
      expect(lista(resposta).status).toBe('FINALIZADO')
    })

    it.each(['AGENDADO', 'CANCELADO'] as const)(
      '%s → 422 EVENTO_STATUS_INVALIDO sem gravar (critérios 5 e 6)',
      async (status) => {
        const ana = await membro('Ana')
        const evento = await treino({ status })

        const resposta = await (await como()).registrar(evento.id, { presentes: [ana.id] })

        expect(resposta.status).toBe(422)
        expect(erro(resposta)).toMatchObject({
          code: 'EVENTO_STATUS_INVALIDO',
          message: 'A presença só pode ser registrada em eventos em andamento ou finalizados.',
        })
        await expect(linhas(evento)).resolves.toEqual([])
        await expect(registros()).resolves.toEqual([])
      },
    )

    it('id fora do elenco, inclusive de outra atlética → 422 ATLETA_FORA_DO_ELENCO sem gravar (critério 7)', async () => {
      const ana = await membro('Ana')
      const novato = await membro('Novato', { entradaEm: new Date(INICIO.getTime() + HORA_MS) })
      const outraAtletica = await criarUsuario({ atleticaId: (await criarAtletica()).id })
      const evento = await treino()

      const resposta = await (
        await como()
      ).registrar(evento.id, { presentes: [ana.id, novato.id, outraAtletica.id] })

      expect(resposta.status).toBe(422)
      expect(erro(resposta)).toMatchObject({
        code: 'ATLETA_FORA_DO_ELENCO',
        details: [
          { field: 'presentes', message: novato.id },
          { field: 'presentes', message: outraAtletica.id },
        ],
      })
      await expect(linhas(evento)).resolves.toEqual([])
    })

    it('falha na auditoria desfaz a gravação das presenças', async () => {
      const { evento, ana } = await cenarioCincoMembros()
      const antes = await linhas(evento)
      jest
        .spyOn(contexto.app.get(AuditoriaService), 'registrar')
        .mockRejectedValueOnce(new Error('falha na auditoria'))

      const resposta = await (await como()).registrar(evento.id, { presentes: [ana.id] })

      expect(resposta.status).toBe(500)
      await expect(linhas(evento)).resolves.toEqual(antes)
      await expect(registros()).resolves.toEqual([])
    })

    it.each([
      ['sem presentes', {}],
      ['id não-UUID', { presentes: ['abc'] }],
      ['ids repetidos', { presentes: [ID_INEXISTENTE, ID_INEXISTENTE] }],
      ['campo extra', { presentes: [], eventoId: ID_INEXISTENTE }],
    ])('corpo inválido (%s) → 400 VALIDATION_ERROR', async (_, corpo) => {
      const evento = await treino()
      const resposta = await (await como()).registrar(evento.id, corpo)
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
    })
  })

  describe('autorização (critérios 9 e 10)', () => {
    it('sem token → 401 nas duas rotas', async () => {
      const evento = await treino()
      const respostas = [
        await request(contexto.http).get(`${ROTA}/${evento.id}/presencas`),
        await request(contexto.http).put(`${ROTA}/${evento.id}/presencas`).send({ presentes: [] }),
      ]
      for (const resposta of respostas) {
        expect(resposta.status).toBe(401)
        expect(erro(resposta).code).toBe('UNAUTHENTICATED')
      }
    })

    it('ATLETA (mesmo membro do elenco) → 403 nas duas rotas', async () => {
      const atleta = await membro('Ana')
      const evento = await treino()
      const api = await como(atleta)

      const respostas = [
        await api.listar(evento.id),
        await api.registrar(evento.id, { presentes: [atleta.id] }),
      ]

      expect(respostas.map(({ status }) => status)).toEqual([403, 403])
      expect(respostas.every((resposta) => erro(resposta).code === 'FORBIDDEN')).toBe(true)
      await expect(linhas(evento)).resolves.toEqual([])
    })

    it('evento de outra atlética, inexistente ou excluído → 404 nas duas rotas', async () => {
      const alheio = await criarEvento({
        atleticaId: (await criarAtletica()).id,
        status: 'EM_ANDAMENTO',
      })
      const excluido = await treino({ excluidoEm: new Date() })
      const api = await como()

      for (const id of [alheio.id, ID_INEXISTENTE, excluido.id]) {
        const respostas = [await api.listar(id), await api.registrar(id, { presentes: [] })]
        expect(respostas.map(({ status }) => status)).toEqual([404, 404])
        expect(respostas.every((resposta) => erro(resposta).code === 'NOT_FOUND')).toBe(true)
      }
      await expect(linhas(alheio)).resolves.toEqual([])
    })
  })

  it('regressão #70: evento com presença registrada não pode ser excluído (409)', async () => {
    const ana = await membro('Ana')
    const evento = await treino()
    await (await como()).registrar(evento.id, { presentes: [ana.id] }).expect(200)

    const resposta = await (await como('PRESIDENTE')).excluir(evento.id)

    expect(resposta.status).toBe(409)
    expect(erro(resposta).code).toBe('EVENTO_COM_DEPENDENCIAS')
  })
})
