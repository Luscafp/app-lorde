import { listaSolicitacoesSchema, solicitacaoPainelDtoSchema, type Papel } from '@atletica/shared'
import { EventEmitter2 } from '@nestjs/event-emitter'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import type { SolicitacaoEntrada, Time } from '../../src/generated/prisma/client'
import { AuditoriaService } from '../../src/modules/auditoria/auditoria.service'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarSolicitacao } from '../fabricas/solicitacoes'
import { adicionarMembro, criarTime } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

describe('/solicitacoes no Painel (#69)', () => {
  let contexto: AppDeTeste
  let eventos: EspiaoEventos
  let atleticaId: string
  let time: Time
  let atleta: UsuarioCriado
  let diretor: UsuarioCriado
  let solicitacao: SolicitacaoEntrada

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica({ sigla: 'LORDE' })).id
    time = await criarTime({ atleticaId, nome: 'Futsal Masculino' })
    atleta = await criarUsuario({ atleticaId, nome: 'Carlos Lima' })
    diretor = await criarUsuario({ atleticaId, papel: 'DIRETOR', nome: 'Maria Diretora' })
    solicitacao = await criarSolicitacao(time, atleta)
    eventos = espiarEventos(contexto.app)
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  async function como(papel: Papel | UsuarioCriado = diretor) {
    const alvo = typeof papel === 'string' ? await criarUsuario({ papel, atleticaId }) : papel
    const auth = `Bearer ${await tokenPara(alvo)}`
    const http = contexto.http
    return {
      listar: (consulta = '') =>
        request(http).get(`/api/v1/solicitacoes${consulta}`).set('Authorization', auth),
      aprovar: (id = solicitacao.id) =>
        request(http).post(`/api/v1/solicitacoes/${id}/aprovar`).set('Authorization', auth),
      rejeitar: (id = solicitacao.id) =>
        request(http).post(`/api/v1/solicitacoes/${id}/rejeitar`).set('Authorization', auth),
      cancelar: (id = solicitacao.id) =>
        request(http).post(`/api/v1/solicitacoes/${id}/cancelar`).set('Authorization', auth),
    }
  }

  const avaliadas = async () => {
    await aguardarOuvintes()
    return eventos.emitidos().filter(({ nome }) => nome === 'solicitacao.avaliada')
  }

  const vinculosAtivos = () =>
    prismaTeste.membroTime.findMany({
      where: { timeId: time.id, usuarioId: atleta.id, saidaEm: null },
    })

  const auditorias = () =>
    prismaTeste.registroAuditoria.findMany({
      where: { atleticaId },
      orderBy: [{ criadoEm: 'asc' }, { entidade: 'desc' }],
    })

  describe('autenticação, papel e escopo (critério 16)', () => {
    it.each([
      ['GET', '/api/v1/solicitacoes'],
      ['POST', `/api/v1/solicitacoes/${ID_INEXISTENTE}/aprovar`],
      ['POST', `/api/v1/solicitacoes/${ID_INEXISTENTE}/rejeitar`],
    ])('sem token: %s %s → 401', async (metodo, rota) => {
      const http = request(contexto.http)
      const resposta = await (metodo === 'GET' ? http.get(rota) : http.post(rota))
      expect(resposta.status).toBe(401)
      expect(erro(resposta).code).toBe('UNAUTHENTICATED')
    })

    it('Atleta → 403 nas três rotas, sem alterar a solicitação', async () => {
      const api = await como(atleta)
      for (const resposta of [await api.listar(), await api.aprovar(), await api.rejeitar()]) {
        expect([resposta.status, erro(resposta).code]).toEqual([403, 'FORBIDDEN'])
      }
      await expect(
        prismaTeste.solicitacaoEntrada.findUniqueOrThrow({ where: { id: solicitacao.id } }),
      ).resolves.toMatchObject({ status: 'PENDENTE' })
    })

    it('de outra atlética ou inexistente → 404; não aparece na lista', async () => {
      const outra = await criarAtletica()
      const alheio = await criarTime({ atleticaId: outra.id })
      const deFora = await criarSolicitacao(alheio, await criarUsuario({ atleticaId: outra.id }))
      const api = await como()

      for (const id of [deFora.id, ID_INEXISTENTE]) {
        expect([(await api.aprovar(id)).status, (await api.rejeitar(id)).status]).toEqual([
          404, 404,
        ])
      }
      const lista = listaSolicitacoesSchema.parse((await api.listar()).body)
      expect(lista.items.map(({ id }) => id)).toEqual([solicitacao.id])
    })

    it('id não-UUID e query inválida → 400', async () => {
      const api = await como()
      expect((await api.aprovar('abc')).status).toBe(400)
      expect((await api.rejeitar('abc')).status).toBe(400)
      expect((await api.listar('?status=OUTRO')).status).toBe(400)
      expect((await api.listar('?timeId=abc')).status).toBe(400)
      expect((await api.listar('?limit=51')).status).toBe(400)
    })
  })

  describe('GET /solicitacoes', () => {
    it('pendentes da mais antiga para a mais recente, só nome e foto (critério 10)', async () => {
      const outro = await criarUsuario({ atleticaId, nome: 'Ana Souza' })
      const antiga = await criarSolicitacao(time, outro, {
        criadaEm: new Date('2026-09-01T12:00:00.000Z'),
      })
      await criarSolicitacao(time, await criarUsuario({ atleticaId }), { status: 'REJEITADA' })

      const resposta = await (await como()).listar()

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const lista = listaSolicitacoesSchema.parse(resposta.body)
      expect(lista).toMatchObject({ page: 1, limit: 20, total: 2 })
      expect(lista.items.map(({ id }) => id)).toEqual([antiga.id, solicitacao.id])
      expect(lista.items[1]).toMatchObject({
        id: solicitacao.id,
        status: 'PENDENTE',
        criadaEm: solicitacao.criadaEm.toISOString(),
        avaliadaEm: null,
        canceladaEm: null,
        usuario: { id: atleta.id, nome: 'Carlos Lima', fotoUrl: null },
        time: { id: time.id, nome: 'Futsal Masculino', modalidade: { id: time.modalidadeId } },
        avaliadoPor: null,
      })
    })

    it('paginação: limit e page sobre a mesma ordem', async () => {
      for (const dia of [3, 2, 1]) {
        await criarSolicitacao(time, await criarUsuario({ atleticaId }), {
          criadaEm: new Date(`2026-09-0${dia}T12:00:00.000Z`),
        })
      }
      const api = await como()

      const primeira = listaSolicitacoesSchema.parse((await api.listar('?limit=2')).body)
      const segunda = listaSolicitacoesSchema.parse((await api.listar('?limit=2&page=2')).body)

      expect(primeira.total).toBe(4)
      const datas = [...primeira.items, ...segunda.items].map(({ criadaEm }) => criadaEm)
      expect(datas).toEqual([...datas].sort())
      expect(new Set([...primeira.items, ...segunda.items].map(({ id }) => id)).size).toBe(4)
    })

    it('histórico: filtra por status repetível, encerramento mais recente primeiro, com avaliador (critério 17)', async () => {
      const rejeitadaAntes = await criarSolicitacao(time, await criarUsuario({ atleticaId }), {
        status: 'REJEITADA',
        avaliadaEm: new Date('2026-09-10T12:00:00.000Z'),
        avaliadoPorId: diretor.id,
      })
      const rejeitadaDepois = await criarSolicitacao(time, await criarUsuario({ atleticaId }), {
        status: 'REJEITADA',
        avaliadaEm: new Date('2026-09-20T12:00:00.000Z'),
        avaliadoPorId: diretor.id,
      })
      const cancelada = await criarSolicitacao(time, await criarUsuario({ atleticaId }), {
        status: 'CANCELADA',
        canceladaEm: new Date('2026-09-15T12:00:00.000Z'),
      })
      const api = await como()

      const rejeitadas = listaSolicitacoesSchema.parse((await api.listar('?status=REJEITADA')).body)
      expect(rejeitadas.items.map(({ id }) => id)).toEqual([rejeitadaDepois.id, rejeitadaAntes.id])
      expect(rejeitadas.items[0]?.avaliadoPor).toEqual({
        id: diretor.id,
        nome: 'Maria Diretora',
        fotoUrl: null,
      })

      const historico = listaSolicitacoesSchema.parse(
        (await api.listar('?status=REJEITADA&status=CANCELADA')).body,
      )
      expect(historico.items.map(({ id }) => id)).toEqual([
        rejeitadaDepois.id,
        cancelada.id,
        rejeitadaAntes.id,
      ])
    })

    it('filtra por time', async () => {
      const outroTime = await criarTime({ atleticaId, nome: 'Vôlei Feminino' })
      await criarSolicitacao(outroTime, atleta)

      const lista = listaSolicitacoesSchema.parse(
        (await (await como()).listar(`?timeId=${time.id}`)).body,
      )
      expect(lista.items.map(({ id }) => id)).toEqual([solicitacao.id])
    })
  })

  describe('POST /solicitacoes/:id/aprovar', () => {
    it('200 APROVADA, elenco, duas auditorias e evento após o commit (critério 11)', async () => {
      const visiveisNoEmit: Promise<unknown>[] = []
      const emit = jest.spyOn(contexto.app.get(EventEmitter2), 'emit')
      emit.mockImplementation((nome) => {
        if (nome === 'solicitacao.avaliada') visiveisNoEmit.push(vinculosAtivos())
        return true
      })

      try {
        const resposta = await (await como()).aprovar()

        expect(resposta.status).toBe(200)
        const item = solicitacaoPainelDtoSchema.parse(resposta.body)
        expect(item).toMatchObject({
          id: solicitacao.id,
          status: 'APROVADA',
          avaliadoPor: { id: diretor.id, nome: 'Maria Diretora' },
        })
        expect(item.avaliadaEm).not.toBeNull()

        const [membro, ...outros] = await vinculosAtivos()
        expect(outros).toHaveLength(0)
        expect(membro?.solicitacaoId).toBe(solicitacao.id)

        const elenco = await request(contexto.http)
          .get(`/api/v1/times/${time.id}/elenco`)
          .set('Authorization', `Bearer ${await tokenPara(diretor)}`)
        expect((elenco.body as { items: unknown[] }).items).toEqual([
          expect.objectContaining({ usuarioId: atleta.id }),
        ])

        const [aprovada, adicionado, ...resto] = await auditorias()
        expect(resto).toHaveLength(0)
        expect(aprovada).toMatchObject({
          acao: 'SOLICITACAO_APROVADA',
          entidade: 'SolicitacaoEntrada',
          entidadeId: solicitacao.id,
          usuarioId: diretor.id,
          dados: {
            antes: { status: 'PENDENTE' },
            depois: { status: 'APROVADA' },
            contexto: { timeId: time.id, usuarioId: atleta.id },
          },
        })
        expect(adicionado).toMatchObject({
          acao: 'MEMBRO_ADICIONADO',
          entidade: 'MembroTime',
          entidadeId: membro?.id,
          usuarioId: diretor.id,
          dados: { antes: null, contexto: { solicitacaoId: solicitacao.id } },
        })

        const [evento, ...maisEventos] = await avaliadas()
        expect(maisEventos).toHaveLength(0)
        expect(evento?.payload).toEqual({
          atleticaId,
          solicitacaoId: solicitacao.id,
          timeId: time.id,
          usuarioId: atleta.id,
          status: 'APROVADA',
          autorId: diretor.id,
        })
        const [noEmit] = await Promise.all(visiveisNoEmit)
        expect(noEmit).toHaveLength(1)
      } finally {
        emit.mockRestore()
      }
    })

    it('atleta já no elenco: 200 sem duplicar o vínculo, auditoria com jaEraMembro', async () => {
      await adicionarMembro(time, atleta)

      expect((await (await como()).aprovar()).status).toBe(200)

      expect(await vinculosAtivos()).toHaveLength(1)
      const registros = await auditorias()
      expect(registros.map(({ acao }) => acao)).toEqual(['SOLICITACAO_APROVADA'])
      expect(registros[0]?.dados).toMatchObject({ contexto: { jaEraMembro: true } })
    })

    it('time desativado → 422 TIME_INATIVO; rejeitar continua permitido (critério 15)', async () => {
      await prismaTeste.time.update({ where: { id: time.id }, data: { ativo: false } })
      const api = await como()

      const aprovacao = await api.aprovar()
      expect([aprovacao.status, erro(aprovacao).code]).toEqual([422, 'TIME_INATIVO'])
      expect((await api.rejeitar()).status).toBe(200)
      expect(await vinculosAtivos()).toHaveLength(0)
    })

    it('cancelada pelo atleta → 409 SOLICITACAO_CANCELADA, sem MembroTime nem evento (critério 13)', async () => {
      expect((await (await como(atleta)).cancelar()).status).toBe(200)

      const resposta = await (await como()).aprovar()

      expect([resposta.status, erro(resposta).code]).toEqual([409, 'SOLICITACAO_CANCELADA'])
      expect(await vinculosAtivos()).toHaveLength(0)
      expect(await avaliadas()).toHaveLength(0)
    })

    it('falha na auditoria desfaz tudo: nem transição, nem MembroTime, nem evento', async () => {
      const espiao = jest
        .spyOn(contexto.app.get(AuditoriaService), 'registrarVarios')
        .mockRejectedValueOnce(new Error('falha simulada'))
      const resposta = await (await como()).aprovar()
      espiao.mockRestore()

      expect(resposta.status).toBe(500)
      await expect(
        prismaTeste.solicitacaoEntrada.findUniqueOrThrow({ where: { id: solicitacao.id } }),
      ).resolves.toMatchObject({ status: 'PENDENTE', avaliadaEm: null })
      expect(await vinculosAtivos()).toHaveLength(0)
      expect(await avaliadas()).toHaveLength(0)
    })
  })

  describe('POST /solicitacoes/:id/rejeitar', () => {
    it('200 REJEITADA, elenco intacto, auditoria e evento (critério 12)', async () => {
      const resposta = await (await como()).rejeitar()

      expect(resposta.status).toBe(200)
      expect(solicitacaoPainelDtoSchema.parse(resposta.body)).toMatchObject({
        status: 'REJEITADA',
        avaliadoPor: { id: diretor.id },
      })
      expect(await vinculosAtivos()).toHaveLength(0)
      const registros = await auditorias()
      expect(registros).toEqual([
        expect.objectContaining({
          acao: 'SOLICITACAO_REJEITADA',
          entidadeId: solicitacao.id,
          usuarioId: diretor.id,
          dados: {
            antes: { status: 'PENDENTE' },
            depois: { status: 'REJEITADA' },
            contexto: { timeId: time.id, usuarioId: atleta.id },
          },
        }),
      ])
      const [evento] = await avaliadas()
      expect(evento?.payload).toMatchObject({
        status: 'REJEITADA',
        timeId: time.id,
        usuarioId: atleta.id,
        autorId: diretor.id,
      })
    })

    it('após rejeição, o atleta pode solicitar de novo (RN29)', async () => {
      await (await como()).rejeitar()

      const nova = await request(contexto.http)
        .post(`/api/v1/times/${time.id}/solicitacoes`)
        .set('Authorization', `Bearer ${await tokenPara(atleta)}`)
      expect(nova.status).toBe(201)
    })

    it('já avaliada → 409 SOLICITACAO_JA_AVALIADA', async () => {
      const api = await como()
      await api.aprovar()

      const resposta = await api.rejeitar()
      expect([resposta.status, erro(resposta).code]).toEqual([409, 'SOLICITACAO_JA_AVALIADA'])
    })
  })

  describe('concorrência (critério 14)', () => {
    it('aprovar × aprovar: um 200, um 409 JA_AVALIADA e um só vínculo', async () => {
      const [a, b] = [await como(), await como('PRESIDENTE')]

      const respostas = await Promise.all([a.aprovar(), b.aprovar()])

      expect(respostas.map(({ status }) => status).sort()).toEqual([200, 409])
      const perdedora = respostas.find(({ status }) => status === 409)
      expect(perdedora && erro(perdedora).code).toBe('SOLICITACAO_JA_AVALIADA')
      expect(await vinculosAtivos()).toHaveLength(1)
      expect(await avaliadas()).toHaveLength(1)
    })

    it('aprovar × rejeitar: um 200, um 409 JA_AVALIADA e estado coerente', async () => {
      const [a, b] = [await como(), await como('PRESIDENTE')]

      const [aprovacao, rejeicao] = await Promise.all([a.aprovar(), b.rejeitar()])

      expect([aprovacao.status, rejeicao.status].sort()).toEqual([200, 409])
      const final = await prismaTeste.solicitacaoEntrada.findUniqueOrThrow({
        where: { id: solicitacao.id },
      })
      expect(await vinculosAtivos()).toHaveLength(final.status === 'APROVADA' ? 1 : 0)
    })

    it('aprovar × cancelar: estados finais válidos e no máximo um vínculo', async () => {
      const [diretoria, dono] = [await como(), await como(atleta)]

      const [aprovacao, cancelamento] = await Promise.all([diretoria.aprovar(), dono.cancelar()])

      const final = await prismaTeste.solicitacaoEntrada.findUniqueOrThrow({
        where: { id: solicitacao.id },
      })
      if (final.status === 'APROVADA') {
        expect([aprovacao.status, cancelamento.status]).toEqual([200, 409])
        expect(await vinculosAtivos()).toHaveLength(1)
      } else {
        expect(final.status).toBe('CANCELADA')
        expect([aprovacao.status, erro(aprovacao).code]).toEqual([409, 'SOLICITACAO_CANCELADA'])
        expect(cancelamento.status).toBe(200)
        expect(await vinculosAtivos()).toHaveLength(0)
      }
    })
  })
})
