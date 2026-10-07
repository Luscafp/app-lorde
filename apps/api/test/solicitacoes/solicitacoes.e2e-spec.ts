import { solicitacaoDtoSchema, timeDetalheDtoSchema, type Papel } from '@atletica/shared'
import { EventEmitter2 } from '@nestjs/event-emitter'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import type { Time } from '../../src/generated/prisma/client'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarSolicitacao } from '../fabricas/solicitacoes'
import { adicionarMembro, criarTime, criarTimeAdversario } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

describe('/times/:id/solicitacoes e /solicitacoes/:id/cancelar (#68)', () => {
  let contexto: AppDeTeste
  let eventos: EspiaoEventos
  let atleticaId: string
  let time: Time
  let atleta: UsuarioCriado

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica({ sigla: 'LORDE' })).id
    time = await criarTime({ atleticaId, nome: 'Futsal Masculino' })
    atleta = await criarUsuario({ atleticaId, nome: 'Carlos Lima' })
    eventos = espiarEventos(contexto.app)
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  async function como(papel: Papel | UsuarioCriado = atleta) {
    const alvo = typeof papel === 'string' ? await criarUsuario({ papel, atleticaId }) : papel
    const auth = `Bearer ${await tokenPara(alvo)}`
    const http = contexto.http
    return {
      solicitar: (timeId = time.id) =>
        request(http).post(`/api/v1/times/${timeId}/solicitacoes`).set('Authorization', auth),
      cancelar: (id: string) =>
        request(http).post(`/api/v1/solicitacoes/${id}/cancelar`).set('Authorization', auth),
      detalhe: (timeId = time.id) =>
        request(http).get(`/api/v1/times/${timeId}`).set('Authorization', auth),
    }
  }

  const criadas = async () => {
    await aguardarOuvintes()
    return eventos.emitidos().filter(({ nome }) => nome === 'solicitacao.criada')
  }

  const pendentes = () =>
    prismaTeste.solicitacaoEntrada.count({
      where: { timeId: time.id, usuarioId: atleta.id, status: 'PENDENTE' },
    })

  describe('autenticação e escopo', () => {
    it.each([
      ['POST', `/api/v1/times/${ID_INEXISTENTE}/solicitacoes`],
      ['POST', `/api/v1/solicitacoes/${ID_INEXISTENTE}/cancelar`],
    ])('sem token: %s %s → 401', async (_, rota) => {
      const resposta = await request(contexto.http).post(rota)
      expect(resposta.status).toBe(401)
      expect(erro(resposta).code).toBe('UNAUTHENTICATED')
    })

    it('id não-UUID → 400', async () => {
      const api = await como()
      expect((await api.solicitar('abc')).status).toBe(400)
      expect((await api.cancelar('abc')).status).toBe(400)
    })

    it.each<Papel>(['DIRETOR', 'PRESIDENTE', 'ADMINISTRADOR'])(
      'qualquer papel solicita (sem 403): %s',
      async (papel) => {
        expect((await (await como(papel)).solicitar()).status).toBe(201)
      },
    )
  })

  describe('POST /times/:id/solicitacoes', () => {
    it('201 PENDENTE e solicitacao.criada após o commit (critério 1)', async () => {
      const visiveisNoEmit: Promise<number>[] = []
      const emit = jest.spyOn(contexto.app.get(EventEmitter2), 'emit')
      emit.mockImplementation((nome) => {
        if (nome === 'solicitacao.criada') visiveisNoEmit.push(pendentes())
        return true
      })

      try {
        const resposta = await (await como()).solicitar()

        expect(resposta.status).toBe(201)
        expect(resposta.headers['cache-control']).toBe('no-store')
        const solicitacao = solicitacaoDtoSchema.parse(resposta.body)
        expect(solicitacao).toMatchObject({
          timeId: time.id,
          status: 'PENDENTE',
          canceladaEm: null,
        })
        await expect(
          prismaTeste.solicitacaoEntrada.findUniqueOrThrow({ where: { id: solicitacao.id } }),
        ).resolves.toMatchObject({ atleticaId, usuarioId: atleta.id })

        const [evento, ...outros] = await criadas()
        expect(outros).toHaveLength(0)
        expect(evento?.payload).toEqual({
          atleticaId,
          solicitacaoId: solicitacao.id,
          timeId: time.id,
          autorId: atleta.id,
        })
        await expect(Promise.all(visiveisNoEmit)).resolves.toEqual([1])
      } finally {
        emit.mockRestore()
      }
    })

    it('sem auditoria', async () => {
      await (await como()).solicitar()
      await expect(prismaTeste.registroAuditoria.count()).resolves.toBe(0)
    })

    it('já pendente → 409 SOLICITACAO_PENDENTE e continua uma só (critério 2)', async () => {
      const api = await como()
      expect((await api.solicitar()).status).toBe(201)

      const resposta = await api.solicitar()

      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('SOLICITACAO_PENDENTE')
      await expect(pendentes()).resolves.toBe(1)
      expect(await criadas()).toHaveLength(1)
    })

    it('corrida criar × criar: um 201 e um 409 (critério 3)', async () => {
      const api = await como()
      const respostas = await Promise.all([api.solicitar(), api.solicitar()])

      expect(respostas.map(({ status }) => status).sort()).toEqual([201, 409])
      const conflito = respostas.find(({ status }) => status === 409)
      expect(conflito && erro(conflito).code).toBe('SOLICITACAO_PENDENTE')
      await expect(pendentes()).resolves.toBe(1)
      expect(await criadas()).toHaveLength(1)
    })

    it('membro ativo → 409 JA_E_MEMBRO (critério 4)', async () => {
      await adicionarMembro(time, atleta)
      const resposta = await (await como()).solicitar()
      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('JA_E_MEMBRO')
      expect(await criadas()).toHaveLength(0)
    })

    it('ex-membro pode solicitar de novo', async () => {
      await adicionarMembro(time, atleta, { saidaEm: new Date() })
      expect((await (await como()).solicitar()).status).toBe(201)
    })

    it('adversário → 422 TIME_ADVERSARIO; inativo → 422 TIME_INATIVO (critério 5)', async () => {
      const api = await como()
      const adversario = await criarTimeAdversario()
      const inativo = await criarTime({ atleticaId, ativo: false })

      const [contraAdversario, contraInativo] = [
        await api.solicitar(adversario.id),
        await api.solicitar(inativo.id),
      ]

      expect([contraAdversario.status, erro(contraAdversario).code]).toEqual([
        422,
        'TIME_ADVERSARIO',
      ])
      expect([contraInativo.status, erro(contraInativo).code]).toEqual([422, 'TIME_INATIVO'])
      expect(await criadas()).toHaveLength(0)
    })

    it('time de outra atlética que usa o app ou inexistente → 404 (critério 5)', async () => {
      const outra = await criarAtletica()
      const alheio = await criarTime({ atleticaId: outra.id })
      const api = await como()

      for (const resposta of [
        await api.solicitar(alheio.id),
        await api.solicitar(ID_INEXISTENTE),
      ]) {
        expect(resposta.status).toBe(404)
        expect(erro(resposta).code).toBe('NOT_FOUND')
      }
    })

    it.each(['REJEITADA', 'CANCELADA'] as const)(
      'nova solicitação após %s (RN29)',
      async (status) => {
        await criarSolicitacao(time, atleta, { status })
        expect((await (await como()).solicitar()).status).toBe(201)
      },
    )
  })

  describe('POST /solicitacoes/:id/cancelar', () => {
    it('dono e pendente: 200 CANCELADA com canceladaEm, sem evento (critério 6)', async () => {
      const solicitacao = await criarSolicitacao(time, atleta)

      const resposta = await (await como()).cancelar(solicitacao.id)

      expect(resposta.status).toBe(200)
      expect(solicitacaoDtoSchema.parse(resposta.body)).toMatchObject({
        id: solicitacao.id,
        status: 'CANCELADA',
        canceladaEm: expect.any(String) as string,
      })
      await expect(pendentes()).resolves.toBe(0)
      await aguardarOuvintes()
      expect(eventos.nomes()).toHaveLength(0)
      await expect(prismaTeste.registroAuditoria.count()).resolves.toBe(0)
    })

    it('de outro usuário → 404 e continua pendente (critério 7)', async () => {
      const outro = await criarUsuario({ atleticaId })
      const solicitacao = await criarSolicitacao(time, outro)

      const resposta = await (await como()).cancelar(solicitacao.id)

      expect(resposta.status).toBe(404)
      expect(erro(resposta).code).toBe('NOT_FOUND')
      await expect(
        prismaTeste.solicitacaoEntrada.findUniqueOrThrow({ where: { id: solicitacao.id } }),
      ).resolves.toMatchObject({ status: 'PENDENTE' })
    })

    it('de outra atlética ou inexistente → 404', async () => {
      const outra = await criarAtletica()
      const alheio = await criarTime({ atleticaId: outra.id })
      const solicitacao = await criarSolicitacao(alheio, atleta)
      const api = await como()

      expect((await api.cancelar(solicitacao.id)).status).toBe(404)
      expect((await api.cancelar(ID_INEXISTENTE)).status).toBe(404)
    })

    it.each(['APROVADA', 'REJEITADA'] as const)(
      '%s → 409 SOLICITACAO_JA_AVALIADA (critério 8)',
      async (status) => {
        const solicitacao = await criarSolicitacao(time, atleta, { status })
        const resposta = await (await como()).cancelar(solicitacao.id)
        expect(resposta.status).toBe(409)
        expect(erro(resposta).code).toBe('SOLICITACAO_JA_AVALIADA')
      },
    )

    it('já cancelada: 200 com o estado atual, sem nova gravação (critério 9)', async () => {
      const canceladaEm = new Date('2026-09-30T15:00:00.000Z')
      const solicitacao = await criarSolicitacao(time, atleta, { status: 'CANCELADA', canceladaEm })

      const resposta = await (await como()).cancelar(solicitacao.id)

      expect(resposta.status).toBe(200)
      expect(solicitacaoDtoSchema.parse(resposta.body)).toMatchObject({
        status: 'CANCELADA',
        canceladaEm: canceladaEm.toISOString(),
      })
    })
  })

  describe('GET /times/:id com minhaSituacao', () => {
    it('nenhuma → pendente → membro', async () => {
      const api = await como()
      const situacao = async () =>
        timeDetalheDtoSchema.parse((await api.detalhe()).body).minhaSituacao

      await expect(situacao()).resolves.toEqual({ membro: false, solicitacaoPendente: null })

      const criada = solicitacaoDtoSchema.parse((await api.solicitar()).body)
      await expect(situacao()).resolves.toEqual({
        membro: false,
        solicitacaoPendente: { id: criada.id, criadaEm: criada.criadaEm },
      })

      await adicionarMembro(time, atleta)
      await expect(situacao()).resolves.toMatchObject({ membro: true })
    })

    it('situação é de quem consulta, não de outros usuários', async () => {
      const outro = await criarUsuario({ atleticaId })
      await criarSolicitacao(time, outro)
      await adicionarMembro(time, await criarUsuario({ atleticaId }))

      const corpo = timeDetalheDtoSchema.parse((await (await como()).detalhe()).body)
      expect(corpo.minhaSituacao).toEqual({ membro: false, solicitacaoPendente: null })
    })

    it('time adversário → null', async () => {
      const adversario = await criarTimeAdversario()
      const corpo = timeDetalheDtoSchema.parse((await (await como()).detalhe(adversario.id)).body)
      expect(corpo.minhaSituacao).toBeNull()
    })
  })
})
