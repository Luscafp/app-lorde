import { elencoDtoSchema, timeDtoSchema, type Papel } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import type { Time } from '../../src/generated/prisma/client'
import { ContextoAtletica } from '../../src/infra/contexto/contexto-atletica.service'
import { PrismaService } from '../../src/infra/prisma/prisma.service'
import { AuditoriaService } from '../../src/modules/auditoria/auditoria.service'
import { ElencoService, MotivoSaida } from '../../src/modules/times/elenco.service'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { adicionarMembro, criarTime, criarTimeAdversario } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/times'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const UMA_HORA = 60 * 60 * 1000
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

describe('/times/:id/elenco e /times/:id/capitao (#64)', () => {
  let contexto: AppDeTeste
  let atleticaId: string
  let time: Time

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica({ sigla: 'LORDE' })).id
    time = await criarTime({ atleticaId, nome: 'Futsal Masculino' })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  const usuario = (papel: Papel = 'ATLETA', nome?: string) =>
    criarUsuario({ papel, atleticaId, nome })

  async function membro(nome: string) {
    const atleta = await usuario('ATLETA', nome)
    await adicionarMembro(time, atleta)
    return atleta
  }

  async function como(papel: Papel | UsuarioCriado) {
    const alvo = typeof papel === 'string' ? await usuario(papel) : papel
    const auth = `Bearer ${await tokenPara(alvo)}`
    const http = contexto.http
    return {
      elenco: (timeId = time.id) =>
        request(http).get(`${ROTA}/${timeId}/elenco`).set('Authorization', auth),
      remover: (usuarioId: string, timeId = time.id) =>
        request(http).delete(`${ROTA}/${timeId}/elenco/${usuarioId}`).set('Authorization', auth),
      capitao: (usuarioId: string | null, timeId = time.id) =>
        request(http)
          .put(`${ROTA}/${timeId}/capitao`)
          .set('Authorization', auth)
          .send({ usuarioId }),
    }
  }

  const registros = (entidade: 'Time' | 'MembroTime') =>
    prismaTeste.registroAuditoria.findMany({ where: { entidade }, orderBy: { criadoEm: 'asc' } })

  const capitaoAtual = async () =>
    (await prismaTeste.time.findUniqueOrThrow({ where: { id: time.id } })).capitaoId

  const vinculosAtivos = (usuarioId: string) =>
    prismaTeste.membroTime.count({ where: { timeId: time.id, usuarioId, saidaEm: null } })

  async function criarEvento(dados: { inicio: Date; status?: 'AGENDADO' | 'FINALIZADO' }) {
    const autor = await usuario('DIRETOR')
    return prismaTeste.evento.create({
      data: {
        atleticaId,
        tipo: 'TREINO',
        timeId: time.id,
        local: 'Ginásio',
        criadoPorId: autor.id,
        ...dados,
      },
    })
  }

  describe('GET elenco', () => {
    it('qualquer papel: capitã primeiro, depois por nome, sem e-mail (critério 11)', async () => {
      const bruno = await membro('Bruno Lima')
      const ana = await membro('Ana Souza')
      await prismaTeste.time.update({ where: { id: time.id }, data: { capitaoId: bruno.id } })
      const historico = await usuario('ATLETA', 'Carla')
      await adicionarMembro(time, historico, { saidaEm: new Date() })

      const resposta = await (await como('ATLETA')).elenco()

      expect(resposta.status).toBe(200)
      const elenco = elencoDtoSchema.parse(resposta.body)
      expect(elenco.total).toBe(2)
      expect(elenco.items.map(({ usuarioId, capitao }) => [usuarioId, capitao])).toEqual([
        [bruno.id, true],
        [ana.id, false],
      ])
      expect(JSON.stringify(resposta.body)).not.toContain('@')
    })

    it('usuário excluído aparece como "Usuário excluído" sem foto', async () => {
      const atleta = await membro('Diego')
      await prismaTeste.usuario.update({
        where: { id: atleta.id },
        data: { fotoKey: 'usuarios/x/perfil/f.jpg', excluidoEm: new Date() },
      })
      const [item] = elencoDtoSchema.parse((await (await como('ATLETA')).elenco()).body).items
      expect(item).toMatchObject({ nome: 'Usuário excluído', fotoUrl: null })
    })

    it('time inativo: 404 para Atleta, 200 para Diretoria', async () => {
      await prismaTeste.time.update({ where: { id: time.id }, data: { ativo: false } })
      expect((await (await como('ATLETA')).elenco()).status).toBe(404)
      expect((await (await como('DIRETOR')).elenco()).status).toBe(200)
    })
  })

  describe('DELETE elenco', () => {
    it('remove a capitã: saidaEm, capitaoId nulo e MEMBRO_REMOVIDO (critério 14)', async () => {
      const ana = await membro('Ana')
      await prismaTeste.time.update({ where: { id: time.id }, data: { capitaoId: ana.id } })
      const diretor = await usuario('DIRETOR')

      const resposta = await (await como(diretor)).remover(ana.id)

      expect(resposta.status).toBe(204)
      await expect(vinculosAtivos(ana.id)).resolves.toBe(0)
      await expect(capitaoAtual()).resolves.toBeNull()
      const elenco = elencoDtoSchema.parse((await (await como('ATLETA')).elenco()).body)
      expect(elenco.total).toBe(0)

      const vinculo = await prismaTeste.membroTime.findFirstOrThrow({
        where: { usuarioId: ana.id },
      })
      const [registro] = await registros('MembroTime')
      expect(registro).toMatchObject({
        acao: 'MEMBRO_REMOVIDO',
        entidadeId: vinculo.id,
        usuarioId: diretor.id,
        dados: {
          antes: { saidaEm: null },
          depois: { saidaEm: vinculo.saidaEm?.toISOString() },
          contexto: {
            timeId: time.id,
            usuarioId: ana.id,
            capitaniaRemovida: true,
            participacoesRemovidas: 0,
          },
        },
      })
    })

    it('apaga a confirmação futura e mantém a presença passada', async () => {
      const ana = await membro('Ana')
      const futuro = await criarEvento({ inicio: new Date(Date.now() + UMA_HORA) })
      const passado = await criarEvento({
        inicio: new Date(Date.now() - UMA_HORA),
        status: 'FINALIZADO',
      })
      const agora = new Date()
      const resposta = { usuarioId: ana.id, atleticaId, confirmado: true, respondidoEm: agora }
      await prismaTeste.participacao.createMany({
        data: [
          { ...resposta, eventoId: futuro.id },
          { ...resposta, eventoId: passado.id, presente: true, presencaRegistradaEm: agora },
        ],
      })

      expect((await (await como('DIRETOR')).remover(ana.id)).status).toBe(204)

      const restantes = await prismaTeste.participacao.findMany({ where: { usuarioId: ana.id } })
      expect(restantes.map(({ eventoId }) => eventoId)).toEqual([passado.id])
      const [registro] = await registros('MembroTime')
      expect(registro?.dados).toMatchObject({ contexto: { participacoesRemovidas: 1 } })
    })

    it('sem vínculo ativo (ex-membro ou nunca foi) → 404 MEMBRO_NAO_ENCONTRADO (critério 15)', async () => {
      const ex = await usuario()
      await adicionarMembro(time, ex, { saidaEm: new Date() })
      const nunca = await usuario()
      const api = await como('DIRETOR')

      for (const alvo of [ex, nunca]) {
        const resposta = await api.remover(alvo.id)
        expect(resposta.status).toBe(404)
        expect(erro(resposta).code).toBe('MEMBRO_NAO_ENCONTRADO')
      }
      await expect(registros('MembroTime')).resolves.toHaveLength(0)
    })

    it('falha na auditoria desfaz a remoção (rollback)', async () => {
      const ana = await membro('Ana')
      await prismaTeste.time.update({ where: { id: time.id }, data: { capitaoId: ana.id } })
      const espiao = jest
        .spyOn(contexto.app.get(AuditoriaService), 'registrar')
        .mockRejectedValueOnce(new Error('falha simulada'))
      const resposta = await (await como('DIRETOR')).remover(ana.id)
      espiao.mockRestore()

      expect(resposta.status).toBe(500)
      await expect(vinculosAtivos(ana.id)).resolves.toBe(1)
      await expect(capitaoAtual()).resolves.toBe(ana.id)
    })
  })

  describe('PUT capitao', () => {
    it('troca a capitã por Bruno e audita CAPITAO_DEFINIDO (critério 12)', async () => {
      const ana = await membro('Ana')
      const bruno = await membro('Bruno')
      await prismaTeste.time.update({ where: { id: time.id }, data: { capitaoId: ana.id } })

      const resposta = await (await como('DIRETOR')).capitao(bruno.id)

      expect(resposta.status).toBe(200)
      expect(timeDtoSchema.parse(resposta.body).capitao).toEqual({ id: bruno.id, nome: 'Bruno' })
      const [registro] = await registros('Time')
      expect(registro).toMatchObject({
        acao: 'CAPITAO_DEFINIDO',
        entidadeId: time.id,
        dados: { antes: { capitaoId: ana.id }, depois: { capitaoId: bruno.id } },
      })
    })

    it('null remove o capitão (CAPITAO_REMOVIDO); repetir não audita', async () => {
      const ana = await membro('Ana')
      await prismaTeste.time.update({ where: { id: time.id }, data: { capitaoId: ana.id } })
      const api = await como('DIRETOR')

      expect(timeDtoSchema.parse((await api.capitao(null)).body).capitao).toBeNull()
      expect((await api.capitao(null)).status).toBe(200)
      const acoes = (await registros('Time')).map(({ acao }) => acao)
      expect(acoes).toEqual(['CAPITAO_REMOVIDO'])
    })

    it('Carla fora do elenco (nunca foi ou já saiu) → 422 CAPITAO_FORA_DO_ELENCO (critério 13)', async () => {
      const ex = await usuario()
      await adicionarMembro(time, ex, { saidaEm: new Date() })
      const nunca = await usuario()
      const api = await como('DIRETOR')

      for (const alvo of [ex, nunca]) {
        const resposta = await api.capitao(alvo.id)
        expect(resposta.status).toBe(422)
        expect(erro(resposta).code).toBe('CAPITAO_FORA_DO_ELENCO')
      }
      await expect(capitaoAtual()).resolves.toBeNull()
    })

    it('corpo inválido ou com campo extra → 400', async () => {
      const auth = `Bearer ${await tokenPara(await usuario('DIRETOR'))}`
      for (const corpo of [{ usuarioId: 'abc' }, {}, { usuarioId: null, capitaoId: null }]) {
        const resposta = await request(contexto.http)
          .put(`${ROTA}/${time.id}/capitao`)
          .set('Authorization', auth)
          .send(corpo)
        expect(resposta.status).toBe(400)
        expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('encerrarVinculo (contrato para #12 e #34)', () => {
    it.each([
      [MotivoSaida.SAIU, 'MEMBRO_SAIU'],
      [MotivoSaida.EXCLUSAO_CONTA, 'MEMBRO_REMOVIDO_EXCLUSAO_CONTA'],
    ])('motivo %s → %s com ator = executorId', async (motivo, acao) => {
      const ana = await membro('Ana')
      const resultado = await contexto.app
        .get(ContextoAtletica)
        .executarComAtletica(atleticaId, () =>
          contexto.app.get(PrismaService).db.$transaction((tx) =>
            contexto.app.get(ElencoService).encerrarVinculo(tx, {
              timeId: time.id,
              usuarioId: ana.id,
              motivo,
              executorId: ana.id,
            }),
          ),
        )

      expect(resultado).toEqual({ capitaniaRemovida: false, participacoesRemovidas: 0 })
      const [registro] = await registros('MembroTime')
      expect(registro).toMatchObject({ acao, usuarioId: ana.id })
    })
  })

  describe('concorrência e constraints', () => {
    it('PUT capitao × DELETE elenco paralelos: nunca capitão fora do elenco', async () => {
      const api = await como('DIRETOR')
      for (let rodada = 0; rodada < 5; rodada++) {
        const bruno = await membro(`Bruno ${rodada}`)
        const respostas = await Promise.all([api.capitao(bruno.id), api.remover(bruno.id)])

        expect(respostas[1].status).toBe(204)
        expect([200, 422]).toContain(respostas[0].status)
        await expect(vinculosAtivos(bruno.id)).resolves.toBe(0)
        await expect(capitaoAtual()).resolves.toBeNull()
      }
    })

    it('índice parcial: dois vínculos ativos falham; ativo + histórico passa', async () => {
      const ana = await usuario()
      await adicionarMembro(time, ana, { saidaEm: new Date() })
      await adicionarMembro(time, ana)
      await expect(adicionarMembro(time, ana)).rejects.toMatchObject({ code: 'P2002' })
      await expect(vinculosAtivos(ana.id)).resolves.toBe(1)
    })
  })

  describe('autorização e escopo', () => {
    it('sem token → 401 nas três rotas', async () => {
      const http = contexto.http
      const respostas = await Promise.all([
        request(http).get(`${ROTA}/${time.id}/elenco`),
        request(http).delete(`${ROTA}/${time.id}/elenco/${ID_INEXISTENTE}`),
        request(http).put(`${ROTA}/${time.id}/capitao`).send({ usuarioId: null }),
      ])
      expect(respostas.map(({ status }) => status)).toEqual([401, 401, 401])
    })

    it('ATLETA → 403 em PUT capitao e DELETE elenco (critério 17)', async () => {
      const ana = await membro('Ana')
      const api = await como('ATLETA')
      const respostas = [await api.capitao(ana.id), await api.remover(ana.id)]
      expect(respostas.map(({ status }) => status)).toEqual([403, 403])
      await expect(vinculosAtivos(ana.id)).resolves.toBe(1)
    })

    it('time adversário → 422 TIME_ADVERSARIO nas três rotas (critério 16)', async () => {
      const adversario = await criarTimeAdversario({ modalidadeId: time.modalidadeId })
      const alvo = await usuario()
      const api = await como('DIRETOR')

      const respostas = [
        await api.elenco(adversario.id),
        await api.remover(alvo.id, adversario.id),
        await api.capitao(alvo.id, adversario.id),
      ]
      for (const resposta of respostas) {
        expect(resposta.status).toBe(422)
        expect(erro(resposta).code).toBe('TIME_ADVERSARIO')
      }
    })

    it('time de outra atlética que usa o app ou inexistente → 404 (critério 18)', async () => {
      const outra = await criarAtletica()
      const alheio = await criarTime({ atleticaId: outra.id, modalidadeId: time.modalidadeId })
      const atletaAlheio = await criarUsuario({ atleticaId: outra.id })
      await adicionarMembro(alheio, atletaAlheio)
      const api = await como('DIRETOR')

      for (const timeId of [alheio.id, ID_INEXISTENTE]) {
        const respostas = [
          await api.elenco(timeId),
          await api.remover(atletaAlheio.id, timeId),
          await api.capitao(atletaAlheio.id, timeId),
        ]
        expect(respostas.map(({ status }) => status)).toEqual([404, 404, 404])
        expect(respostas.map((resposta) => erro(resposta).code)).toEqual([
          'NOT_FOUND',
          'NOT_FOUND',
          'NOT_FOUND',
        ])
      }
      await expect(
        prismaTeste.membroTime.count({ where: { timeId: alheio.id, saidaEm: null } }),
      ).resolves.toBe(1)
    })
  })
})
