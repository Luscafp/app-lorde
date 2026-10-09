import { elencoDtoSchema, saidaTimeDtoSchema, timeDetalheDtoSchema } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import type { Time } from '../../src/generated/prisma/client'
import { AuditoriaService } from '../../src/modules/auditoria/auditoria.service'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarEvento, criarJogo, criarTreino } from '../fabricas/eventos'
import { adicionarMembro, criarTime, criarTimeAdversario } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/times'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const UMA_HORA = 60 * 60 * 1000
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

describe('POST /times/:id/sair (#34)', () => {
  let contexto: AppDeTeste
  let eventos: EspiaoEventos
  let atleticaId: string
  let time: Time
  let ana: UsuarioCriado

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica({ sigla: 'LORDE' })).id
    time = await criarTime({ atleticaId, nome: 'Futsal Masculino' })
    ana = await criarUsuario({ atleticaId, nome: 'Ana Souza' })
    await adicionarMembro(time, ana)
    eventos = espiarEventos(contexto.app)
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  async function como(usuario: UsuarioCriado = ana) {
    const auth = `Bearer ${await tokenPara(usuario)}`
    const http = contexto.http
    return {
      sair: (timeId = time.id) =>
        request(http).post(`${ROTA}/${timeId}/sair`).set('Authorization', auth),
      remover: (usuarioId: string) =>
        request(http).delete(`${ROTA}/${time.id}/elenco/${usuarioId}`).set('Authorization', auth),
      elenco: () => request(http).get(`${ROTA}/${time.id}/elenco`).set('Authorization', auth),
      detalhe: () => request(http).get(`${ROTA}/${time.id}`).set('Authorization', auth),
      solicitar: () =>
        request(http).post(`${ROTA}/${time.id}/solicitacoes`).set('Authorization', auth),
      aprovar: (id: string) =>
        request(http).post(`/api/v1/solicitacoes/${id}/aprovar`).set('Authorization', auth),
      responder: (eventoId: string) =>
        request(http)
          .put(`/api/v1/eventos/${eventoId}/participacao`)
          .set('Authorization', auth)
          .send({ confirmado: true }),
    }
  }

  const vinculos = (usuarioId = ana.id) =>
    prismaTeste.membroTime.findMany({
      where: { timeId: time.id, usuarioId },
      orderBy: { entradaEm: 'asc' },
    })

  const capitaoAtual = async () =>
    (await prismaTeste.time.findUniqueOrThrow({ where: { id: time.id } })).capitaoId

  const registrosSaida = () =>
    prismaTeste.registroAuditoria.findMany({ where: { acao: 'MEMBRO_SAIU' } })

  it('membro sai: 200, saidaEm, some do elenco e a tela volta a "Solicitar entrada" (critério 1)', async () => {
    const api = await como()
    const resposta = await api.sair()

    expect(resposta.status).toBe(200)
    const saida = saidaTimeDtoSchema.parse(resposta.body)
    expect(saida).toMatchObject({
      timeId: time.id,
      capitaniaRemovida: false,
      participacoesRemovidas: 0,
    })
    const [vinculo] = await vinculos()
    expect(vinculo?.saidaEm?.toISOString()).toBe(saida.saidaEm)
    expect(elencoDtoSchema.parse((await api.elenco()).body).total).toBe(0)
    expect(timeDetalheDtoSchema.parse((await api.detalhe()).body).minhaSituacao).toEqual({
      membro: false,
      solicitacaoPendente: null,
    })
  })

  it('capitã sai: capitaoId nulo e capitaniaRemovida (critério 2)', async () => {
    await prismaTeste.time.update({ where: { id: time.id }, data: { capitaoId: ana.id } })

    const saida = saidaTimeDtoSchema.parse((await (await como()).sair()).body)

    expect(saida.capitaniaRemovida).toBe(true)
    await expect(capitaoAtual()).resolves.toBeNull()
  })

  it('não capitã sai: capitania de outro membro intacta', async () => {
    const bruno = await criarUsuario({ atleticaId, nome: 'Bruno' })
    await adicionarMembro(time, bruno)
    await prismaTeste.time.update({ where: { id: time.id }, data: { capitaoId: bruno.id } })

    expect((await (await como()).sair()).status).toBe(200)
    await expect(capitaoAtual()).resolves.toBe(bruno.id)
  })

  it('remove só confirmações AGENDADO futuras sem presença deste time (critérios 3 a 5)', async () => {
    const outroTime = await criarTime({ atleticaId, modalidadeId: time.modalidadeId })
    await adicionarMembro(outroTime, ana)
    const vou = [{ usuarioId: ana.id, confirmado: true }]
    const futuro = new Date(Date.now() + 24 * UMA_HORA)
    const passado = new Date(Date.now() - UMA_HORA)

    const treinoAmanha = await criarTreino({ atleticaId, timeId: time.id, participantes: vou })
    const jogoSemana = await criarJogo({
      atleticaId,
      timeId: time.id,
      inicio: new Date(Date.now() + 7 * 24 * UMA_HORA),
      participantes: vou,
    })
    const preservados = await Promise.all([
      criarJogo({
        atleticaId,
        timeId: time.id,
        status: 'FINALIZADO',
        inicio: passado,
        participantes: [{ usuarioId: ana.id, confirmado: true, presente: true }],
      }),
      criarTreino({
        atleticaId,
        timeId: time.id,
        status: 'EM_ANDAMENTO',
        inicio: passado,
        participantes: vou,
      }),
      criarTreino({
        atleticaId,
        timeId: time.id,
        status: 'CANCELADO',
        inicio: futuro,
        participantes: vou,
      }),
      criarTreino({
        atleticaId,
        timeId: time.id,
        inicio: futuro,
        participantes: [{ usuarioId: ana.id, confirmado: true, presente: true }],
      }),
      criarTreino({ atleticaId, timeId: outroTime.id, participantes: vou }),
    ])

    const saida = saidaTimeDtoSchema.parse((await (await como()).sair()).body)

    expect(saida.participacoesRemovidas).toBe(2)
    const restantes = await prismaTeste.participacao.findMany({ where: { usuarioId: ana.id } })
    expect(restantes.map(({ eventoId }) => eventoId).sort()).toEqual(
      preservados.map(({ id }) => id).sort(),
    )
    expect(restantes.map(({ eventoId }) => eventoId)).not.toContain(treinoAmanha.id)
    expect(restantes.map(({ eventoId }) => eventoId)).not.toContain(jogoSemana.id)
  })

  it('ex-membro não confirma mais em evento futuro do time (critério 6)', async () => {
    const treino = await criarEvento({ atleticaId, timeId: time.id })
    const api = await como()
    await api.sair()

    const resposta = await api.responder(treino.id)
    expect(resposta.status).toBe(403)
    expect(erro(resposta).code).toBe('NAO_MEMBRO_DO_ELENCO')
  })

  it('reentrada: nova solicitação aprovada cria um novo MembroTime (critério 7)', async () => {
    const api = await como()
    await api.sair()
    const solicitacao = await api.solicitar()
    expect(solicitacao.status).toBe(201)

    const diretor = await criarUsuario({ atleticaId, papel: 'DIRETOR' })
    const id = (solicitacao.body as { id: string }).id
    expect((await (await como(diretor)).aprovar(id)).status).toBe(200)

    const historico = await vinculos()
    expect(historico).toHaveLength(2)
    expect(historico[0]?.saidaEm).not.toBeNull()
    expect(historico[1]?.saidaEm).toBeNull()
  })

  it('audita MEMBRO_SAIU com o próprio usuário como ator e não emite evento (critérios 8 e 15)', async () => {
    const saida = saidaTimeDtoSchema.parse((await (await como()).sair()).body)
    const [vinculo] = await vinculos()

    const [registro] = await registrosSaida()
    expect(registro).toMatchObject({
      entidade: 'MembroTime',
      entidadeId: vinculo?.id,
      usuarioId: ana.id,
      dados: {
        antes: { saidaEm: null },
        depois: { saidaEm: saida.saidaEm },
        contexto: {
          timeId: time.id,
          usuarioId: ana.id,
          capitaniaRemovida: false,
          participacoesRemovidas: 0,
        },
      },
    })
    await aguardarOuvintes()
    expect(eventos.nomes()).toEqual([])
  })

  it('falha na auditoria desfaz a saída (rollback)', async () => {
    const espiao = jest
      .spyOn(contexto.app.get(AuditoriaService), 'registrar')
      .mockRejectedValueOnce(new Error('falha simulada'))
    const resposta = await (await como()).sair()
    espiao.mockRestore()

    expect(resposta.status).toBe(500)
    const [vinculo] = await vinculos()
    expect(vinculo?.saidaEm).toBeNull()
  })

  it('não membro, ex-membro ou saída repetida → 409 NAO_E_MEMBRO (critério 9)', async () => {
    const nunca = await criarUsuario({ atleticaId })
    const api = await como()
    expect((await api.sair()).status).toBe(200)

    for (const resposta of [await api.sair(), await (await como(nunca)).sair()]) {
      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('NAO_E_MEMBRO')
    }
    await expect(registrosSaida()).resolves.toHaveLength(1)
  })

  it('saída × remoção pela Diretoria em paralelo: um vence, o outro recebe 409/404', async () => {
    const diretor = await criarUsuario({ atleticaId, papel: 'DIRETOR' })
    const [saida, remocao] = await Promise.all([
      (await como()).sair(),
      (await como(diretor)).remover(ana.id),
    ])

    const sucessos = [saida.status === 200, remocao.status === 204].filter(Boolean)
    expect(sucessos).toHaveLength(1)
    expect([200, 409]).toContain(saida.status)
    expect([204, 404]).toContain(remocao.status)
    const historico = await vinculos()
    expect(historico).toHaveLength(1)
    expect(historico[0]?.saidaEm).not.toBeNull()
    await expect(
      prismaTeste.registroAuditoria.count({ where: { entidade: 'MembroTime' } }),
    ).resolves.toBe(1)
  })

  it('qualquer papel pode sair', async () => {
    const diretor = await criarUsuario({ atleticaId, papel: 'DIRETOR' })
    await adicionarMembro(time, diretor)
    expect((await (await como(diretor)).sair()).status).toBe(200)
  })

  it('time inativo: o membro ainda pode sair', async () => {
    await prismaTeste.time.update({ where: { id: time.id }, data: { ativo: false } })
    expect((await (await como()).sair()).status).toBe(200)
  })

  it('time adversário → 422 TIME_ADVERSARIO (critério 10)', async () => {
    const adversario = await criarTimeAdversario({ modalidadeId: time.modalidadeId })
    const resposta = await (await como()).sair(adversario.id)
    expect(resposta.status).toBe(422)
    expect(erro(resposta).code).toBe('TIME_ADVERSARIO')
  })

  it('time inexistente ou de outra atlética → 404; sem token → 401; id inválido → 400 (critério 11)', async () => {
    const outra = await criarAtletica()
    const alheio = await criarTime({ atleticaId: outra.id, modalidadeId: time.modalidadeId })
    const api = await como()

    for (const timeId of [alheio.id, ID_INEXISTENTE]) {
      const resposta = await api.sair(timeId)
      expect(resposta.status).toBe(404)
      expect(erro(resposta).code).toBe('NOT_FOUND')
    }
    expect((await request(contexto.http).post(`${ROTA}/${time.id}/sair`)).status).toBe(401)
    const invalido = await api.sair('abc')
    expect(invalido.status).toBe(400)
    expect(erro(invalido).code).toBe('VALIDATION_ERROR')
    expect((await vinculos())[0]?.saidaEm).toBeNull()
  })
})
