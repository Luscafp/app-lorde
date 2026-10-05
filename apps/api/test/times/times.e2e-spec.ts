import { listaTimesSchema, timeDtoSchema, type Papel } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import type { Time } from '../../src/generated/prisma/client'
import { AuditoriaService } from '../../src/modules/auditoria/auditoria.service'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarModalidade } from '../fabricas/modalidades'
import { criarAtleticaAdversaria, criarTime, criarTimeAdversario } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/times'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

describe('/times (#63)', () => {
  let contexto: AppDeTeste
  let atleticaId: string
  let futsalId: string

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica({ sigla: 'LORDE' })).id
    futsalId = (await criarModalidade({ nome: 'Futsal', icone: 'soccer' })).id
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
      get: (caminho = '') => request(http).get(`${ROTA}${caminho}`).set('Authorization', auth),
      post: (corpo: object) => request(http).post(ROTA).set('Authorization', auth).send(corpo),
      patch: (id: string, corpo: object) =>
        request(http).patch(`${ROTA}/${id}`).set('Authorization', auth).send(corpo),
      delete: (id: string) => request(http).delete(`${ROTA}/${id}`).set('Authorization', auth),
    }
  }

  const registros = () =>
    prismaTeste.registroAuditoria.findMany({
      where: { entidade: 'Time' },
      orderBy: { criadoEm: 'asc' },
    })

  const timeProprio = (dados: Partial<Time> = {}) =>
    criarTime({ atleticaId, modalidadeId: futsalId, ...dados })

  async function criarEvento(dados: { timeId: string; timeAdversarioId?: string }) {
    const autor = await usuario('DIRETOR')
    return prismaTeste.evento.create({
      data: {
        atleticaId,
        tipo: dados.timeAdversarioId ? 'JOGO' : 'TREINO',
        inicio: new Date(),
        local: 'Ginásio',
        criadoPorId: autor.id,
        status: 'CANCELADO',
        ...dados,
      },
    })
  }

  describe('POST', () => {
    it('DIRETOR cria time próprio: 201, propria, ativo, sem capitão e TIME_CRIADO (critério 1)', async () => {
      const diretor = await usuario('DIRETOR')
      const resposta = await (
        await como(diretor)
      ).post({
        nome: 'Futsal Masculino',
        modalidadeId: futsalId,
      })

      expect(resposta.status).toBe(201)
      const time = timeDtoSchema.parse(resposta.body)
      expect(time).toMatchObject({
        nome: 'Futsal Masculino',
        ativo: true,
        capitao: null,
        totalMembros: 0,
        modalidade: { id: futsalId, nome: 'Futsal', icone: 'soccer' },
        atletica: { id: atleticaId, sigla: 'LORDE', propria: true },
      })
      const [registro, ...outros] = await registros()
      expect(outros).toHaveLength(0)
      expect(registro).toMatchObject({
        acao: 'TIME_CRIADO',
        entidadeId: time.id,
        usuarioId: diretor.id,
        atleticaId,
        dados: {
          antes: null,
          depois: { nome: 'Futsal Masculino', modalidadeId: futsalId, atleticaId, ativo: true },
        },
      })
    })

    it('time de atlética adversária criada pela API → propria = false (critério 2)', async () => {
      const api = await como('DIRETOR')
      const adversaria = await request(contexto.http)
        .post('/api/v1/atleticas-adversarias')
        .set('Authorization', `Bearer ${await tokenPara(await usuario('DIRETOR'))}`)
        .send({ nome: 'Atlética Fênix', sigla: 'FNX' })
      expect(adversaria.status).toBe(201)

      const resposta = await api.post({
        nome: 'Fênix Futsal',
        modalidadeId: futsalId,
        atleticaAdversariaId: (adversaria.body as { id: string }).id,
      })
      expect(resposta.status).toBe(201)
      expect(timeDtoSchema.parse(resposta.body).atletica).toMatchObject({
        nome: 'Atlética Fênix',
        sigla: 'FNX',
        propria: false,
      })
    })

    it.each([
      ['de outra atlética que usa o app', 'outra'],
      ['da própria atlética ativa', 'atual'],
      ['inexistente', 'inexistente'],
    ])('atleticaAdversariaId %s → 404 (critério 3)', async (_caso, alvo) => {
      const id =
        alvo === 'outra'
          ? (await criarAtletica()).id
          : alvo === 'atual'
            ? atleticaId
            : ID_INEXISTENTE
      const resposta = await (
        await como('DIRETOR')
      ).post({
        nome: 'Futsal',
        modalidadeId: futsalId,
        atleticaAdversariaId: id,
      })
      expect(resposta.status).toBe(404)
      expect(erro(resposta).code).toBe('NOT_FOUND')
      await expect(prismaTeste.time.count()).resolves.toBe(0)
    })

    it('modalidade inativa → 422 MODALIDADE_INATIVA; inexistente → 404 (critério 4)', async () => {
      const xadrez = await criarModalidade({ ativa: false })
      const api = await como('DIRETOR')
      const inativa = await api.post({ nome: 'Xadrez', modalidadeId: xadrez.id })
      expect(inativa.status).toBe(422)
      expect(erro(inativa).code).toBe('MODALIDADE_INATIVA')
      const inexistente = await api.post({ nome: 'Xadrez', modalidadeId: ID_INEXISTENTE })
      expect(inexistente.status).toBe(404)
    })

    it('nome repetido na modalidade → 409; em outra modalidade é aceito (critério 5)', async () => {
      await timeProprio({ nome: 'Futsal Masculino' })
      const volei = await criarModalidade()
      const api = await como('DIRETOR')

      const duplicado = await api.post({ nome: 'futsal masculino', modalidadeId: futsalId })
      expect(duplicado.status).toBe(409)
      expect(erro(duplicado).code).toBe('TIME_DUPLICADO')
      expect(erro(duplicado).details[0]?.field).toBe('nome')

      const outraModalidade = await api.post({ nome: 'Futsal Masculino', modalidadeId: volei.id })
      expect(outraModalidade.status).toBe(201)
    })

    it('dois POST simultâneos com o mesmo nome → um 201 e um 409', async () => {
      const api = await como('DIRETOR')
      const respostas = await Promise.all([
        api.post({ nome: 'Futsal Feminino', modalidadeId: futsalId }),
        api.post({ nome: 'FUTSAL FEMININO', modalidadeId: futsalId }),
      ])
      expect(respostas.map(({ status }) => status).sort()).toEqual([201, 409])
      expect(respostas.find(({ status }) => status === 409)?.body).toMatchObject({
        code: 'TIME_DUPLICADO',
      })
      await expect(prismaTeste.time.count()).resolves.toBe(1)
      await expect(registros()).resolves.toHaveLength(1)
    })

    it.each([
      ['nome curto', { nome: 'A' }, 'nome'],
      ['modalidade não-UUID', { nome: 'Futsal', modalidadeId: 'x' }, 'modalidadeId'],
      ['campo extra', { nome: 'Futsal', ativo: false }, ''],
    ])('%s → 400 sem gravar', async (_caso, corpo, campo) => {
      const resposta = await (await como('DIRETOR')).post({ modalidadeId: futsalId, ...corpo })
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      expect(erro(resposta).details[0]?.field).toBe(campo)
      await expect(prismaTeste.time.count()).resolves.toBe(0)
    })

    it('falha na auditoria desfaz o cadastro (rollback)', async () => {
      const espiao = jest
        .spyOn(contexto.app.get(AuditoriaService), 'registrar')
        .mockRejectedValueOnce(new Error('falha simulada'))
      const resposta = await (await como('DIRETOR')).post({ nome: 'Golfe', modalidadeId: futsalId })
      espiao.mockRestore()

      expect(resposta.status).toBe(500)
      await expect(prismaTeste.time.count()).resolves.toBe(0)
    })
  })

  describe('GET', () => {
    it('lista com capitão, membros ativos e ordem por modalidade e nome', async () => {
      const basquete = await criarModalidade({ nome: 'Basquete' })
      const ana = await usuario()
      const bruno = await usuario()
      const futsal = await timeProprio({ nome: 'Futsal B', capitaoId: ana.id })
      await timeProprio({ nome: 'Futsal A' })
      await criarTime({ atleticaId, modalidadeId: basquete.id, nome: 'Basquete Z' })
      await prismaTeste.membroTime.createMany({
        data: [
          { atleticaId, timeId: futsal.id, usuarioId: ana.id },
          {
            atleticaId,
            timeId: futsal.id,
            usuarioId: bruno.id,
            entradaEm: new Date(Date.now() - 1000),
            saidaEm: new Date(),
          },
        ],
      })

      const resposta = await (await como('ATLETA')).get()
      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const lista = listaTimesSchema.parse(resposta.body)
      expect(lista).toMatchObject({ page: 1, limit: 20, total: 3 })
      expect(lista.items.map(({ nome }) => nome)).toEqual(['Basquete Z', 'Futsal A', 'Futsal B'])
      expect(lista.items[2]).toMatchObject({
        capitao: { id: ana.id, nome: ana.nome },
        totalMembros: 1,
      })
    })

    it('ATLETA não vê inativos nem modalidade inativa; incluirInativos ignorado', async () => {
      const xadrez = await criarModalidade({ ativa: false })
      await timeProprio({ nome: 'Ativo' })
      const inativo = await timeProprio({ nome: 'Inativo', ativo: false })
      const daModalidadeInativa = await criarTime({
        atleticaId,
        modalidadeId: xadrez.id,
        nome: 'Xadrez',
      })
      const api = await como('ATLETA')

      for (const consulta of ['', '?incluirInativos=true']) {
        const { items } = listaTimesSchema.parse((await api.get(consulta)).body)
        expect(items.map(({ nome }) => nome)).toEqual(['Ativo'])
      }
      for (const time of [inativo, daModalidadeInativa]) {
        const detalhe = await api.get(`/${time.id}`)
        expect(detalhe.status).toBe(404)
        expect(erro(detalhe).code).toBe('NOT_FOUND')
      }
    })

    it('DIRETOR com incluirInativos vê todos e o detalhe dos inativos', async () => {
      const xadrez = await criarModalidade({ ativa: false })
      const inativo = await timeProprio({ ativo: false })
      await criarTime({ atleticaId, modalidadeId: xadrez.id })
      const api = await como('DIRETOR')

      expect(listaTimesSchema.parse((await api.get()).body).total).toBe(0)
      expect(listaTimesSchema.parse((await api.get('?incluirInativos=true')).body).total).toBe(2)
      expect((await api.get(`/${inativo.id}`)).status).toBe(200)
    })

    it('escopo=ADVERSARIOS lista times de adversárias, filtráveis por atlética e nome', async () => {
      const fenix = await criarAtleticaAdversaria({ nome: 'Fênix' })
      await timeProprio({ nome: 'Futsal Lorde' })
      await criarTimeAdversario({ atleticaId: fenix.id, modalidadeId: futsalId, nome: 'Fênix FC' })
      await criarTimeAdversario({ modalidadeId: futsalId, nome: 'Leões' })
      const api = await como('ATLETA')

      const proprios = listaTimesSchema.parse((await api.get()).body)
      expect(proprios.items.map(({ nome }) => nome)).toEqual(['Futsal Lorde'])

      const adversarios = listaTimesSchema.parse((await api.get('?escopo=ADVERSARIOS')).body)
      expect(adversarios.items.map(({ nome }) => nome)).toEqual(['Fênix FC', 'Leões'])
      expect(adversarios.items[0]).toMatchObject({
        atletica: { id: fenix.id, propria: false },
        capitao: null,
        totalMembros: 0,
      })

      const daFenix = await api.get(`?escopo=ADVERSARIOS&atleticaId=${fenix.id}`)
      expect(listaTimesSchema.parse(daFenix.body).items.map(({ nome }) => nome)).toEqual([
        'Fênix FC',
      ])
      const busca = await api.get(`?escopo=ADVERSARIOS&q=${encodeURIComponent('FENIX')}`)
      expect(listaTimesSchema.parse(busca.body).items.map(({ nome }) => nome)).toEqual(['Fênix FC'])
    })

    it('filtra por modalidade e pagina', async () => {
      const volei = await criarModalidade()
      await timeProprio({ nome: 'A' })
      await timeProprio({ nome: 'B' })
      await criarTime({ atleticaId, modalidadeId: volei.id })
      const api = await como('ATLETA')

      const pagina = listaTimesSchema.parse(
        (await api.get(`?modalidadeId=${futsalId}&limit=1&page=2`)).body,
      )
      expect(pagina).toMatchObject({ page: 2, limit: 1, total: 2 })
      expect(pagina.items.map(({ nome }) => nome)).toEqual(['B'])
    })

    it('query inválida → 400', async () => {
      const resposta = await (await como('ATLETA')).get('?escopo=TODOS')
      expect(resposta.status).toBe(400)
      expect(erro(resposta).details[0]?.field).toBe('escopo')
    })
  })

  describe('PATCH', () => {
    it('desativar some para o ATLETA e audita TIME_DESATIVADO (critério 7)', async () => {
      const time = await timeProprio()
      const resposta = await (await como('DIRETOR')).patch(time.id, { ativo: false })

      expect(resposta.status).toBe(200)
      expect(timeDtoSchema.parse(resposta.body).ativo).toBe(false)
      const atleta = await como('ATLETA')
      expect(listaTimesSchema.parse((await atleta.get()).body).items).toEqual([])
      expect((await atleta.get(`/${time.id}`)).status).toBe(404)
      const [registro] = await registros()
      expect(registro).toMatchObject({
        acao: 'TIME_DESATIVADO',
        dados: { antes: { ativo: true }, depois: { ativo: false } },
      })
    })

    it.each(['timeId', 'timeAdversarioId'])(
      'troca de modalidade com evento (%s) → 409 TIME_COM_EVENTOS (critério 6)',
      async (papelNoEvento) => {
        const time = await timeProprio()
        const outro = await timeProprio()
        await criarEvento(
          papelNoEvento === 'timeId'
            ? { timeId: time.id, timeAdversarioId: outro.id }
            : { timeId: outro.id, timeAdversarioId: time.id },
        )
        const volei = await criarModalidade()

        const resposta = await (await como('DIRETOR')).patch(time.id, { modalidadeId: volei.id })
        expect(resposta.status).toBe(409)
        expect(erro(resposta).code).toBe('TIME_COM_EVENTOS')
        await expect(
          prismaTeste.time.findUniqueOrThrow({ where: { id: time.id } }),
        ).resolves.toMatchObject({ modalidadeId: futsalId })
      },
    )

    it('troca de modalidade sem eventos → 200 e TIME_ALTERADO (critério 6)', async () => {
      const time = await timeProprio({ nome: 'Misto' })
      const volei = await criarModalidade({ nome: 'Vôlei' })
      const resposta = await (await como('DIRETOR')).patch(time.id, { modalidadeId: volei.id })

      expect(resposta.status).toBe(200)
      expect(timeDtoSchema.parse(resposta.body).modalidade.nome).toBe('Vôlei')
      const [registro] = await registros()
      expect(registro).toMatchObject({
        acao: 'TIME_ALTERADO',
        dados: { antes: { modalidadeId: futsalId }, depois: { modalidadeId: volei.id } },
      })
    })

    it('sem mudança → 200 sem auditoria', async () => {
      const time = await timeProprio()
      const resposta = await (await como('DIRETOR')).patch(time.id, { ativo: true })
      expect(resposta.status).toBe(200)
      await expect(registros()).resolves.toHaveLength(0)
    })

    it('trocar a atlética ou o capitão pelo corpo → 400', async () => {
      const time = await timeProprio()
      const api = await como('DIRETOR')
      const fenix = await criarAtleticaAdversaria()
      for (const corpo of [{ atleticaAdversariaId: fenix.id }, { capitaoId: fenix.id }, {}]) {
        const resposta = await api.patch(time.id, corpo)
        expect(resposta.status).toBe(400)
        expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      }
    })

    it('nome de outro time na mesma modalidade → 409 TIME_DUPLICADO', async () => {
      await timeProprio({ nome: 'Futsal A' })
      const time = await timeProprio({ nome: 'Futsal B' })
      const resposta = await (await como('DIRETOR')).patch(time.id, { nome: 'FUTSAL A' })
      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('TIME_DUPLICADO')
    })

    it('edita time adversário', async () => {
      const adversario = await criarTimeAdversario({ modalidadeId: futsalId })
      const resposta = await (await como('DIRETOR')).patch(adversario.id, { nome: 'Leões FC' })
      expect(resposta.status).toBe(200)
      expect(timeDtoSchema.parse(resposta.body)).toMatchObject({
        nome: 'Leões FC',
        atletica: { propria: false },
      })
    })
  })

  describe('DELETE', () => {
    it('VICE_PRESIDENTE exclui sem dependências: 204, linha removida e auditoria (critério 8)', async () => {
      const time = await timeProprio({ nome: 'Futsal Masculino' })
      const resposta = await (await como('VICE_PRESIDENTE')).delete(time.id)

      expect(resposta.status).toBe(204)
      await expect(prismaTeste.time.count()).resolves.toBe(0)
      const [registro] = await registros()
      expect(registro).toMatchObject({
        acao: 'TIME_EXCLUIDO',
        entidadeId: time.id,
        dados: {
          antes: { nome: 'Futsal Masculino', modalidadeId: futsalId, atleticaId, ativo: true },
          depois: null,
        },
      })
    })

    it.each([
      'evento cancelado como time',
      'evento como adversário',
      'membro histórico',
      'solicitação rejeitada',
    ])('com %s → 409 TIME_COM_DEPENDENCIAS (critério 9)', async (caso) => {
      const time = await timeProprio()
      const outro = await timeProprio()
      const atleta = await usuario()
      if (caso === 'evento cancelado como time') await criarEvento({ timeId: time.id })
      if (caso === 'evento como adversário') {
        await criarEvento({ timeId: outro.id, timeAdversarioId: time.id })
      }
      if (caso === 'membro histórico') {
        await prismaTeste.membroTime.create({
          data: {
            atleticaId,
            timeId: time.id,
            usuarioId: atleta.id,
            entradaEm: new Date(Date.now() - 1000),
            saidaEm: new Date(),
          },
        })
      }
      if (caso === 'solicitação rejeitada') {
        await prismaTeste.solicitacaoEntrada.create({
          data: {
            atleticaId,
            timeId: time.id,
            usuarioId: atleta.id,
            status: 'REJEITADA',
            avaliadaEm: new Date(),
          },
        })
      }

      const resposta = await (await como('PRESIDENTE')).delete(time.id)
      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('TIME_COM_DEPENDENCIAS')
      await expect(prismaTeste.time.count({ where: { id: time.id } })).resolves.toBe(1)
      await expect(registros()).resolves.toHaveLength(0)
    })

    it('time adversário usado em evento de outra atlética → 409 (FK)', async () => {
      const adversario = await criarTimeAdversario({ modalidadeId: futsalId })
      const outra = await criarAtletica()
      const autor = await criarUsuario({ atleticaId: outra.id })
      const timeDaOutra = await criarTime({ atleticaId: outra.id, modalidadeId: futsalId })
      await prismaTeste.evento.create({
        data: {
          atleticaId: outra.id,
          tipo: 'JOGO',
          timeId: timeDaOutra.id,
          timeAdversarioId: adversario.id,
          inicio: new Date(),
          local: 'Ginásio',
          criadoPorId: autor.id,
        },
      })

      const resposta = await (await como('PRESIDENTE')).delete(adversario.id)
      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('TIME_COM_DEPENDENCIAS')
    })

    it('inexistente → 404; malformado → 400', async () => {
      const api = await como('PRESIDENTE')
      expect((await api.delete(ID_INEXISTENTE)).status).toBe(404)
      expect((await api.delete('abc')).status).toBe(400)
    })
  })

  describe('autorização e escopo', () => {
    it('DIRETOR não exclui → 403 (critério 10)', async () => {
      const time = await timeProprio()
      const resposta = await (await como('DIRETOR')).delete(time.id)
      expect(resposta.status).toBe(403)
      expect(erro(resposta).code).toBe('FORBIDDEN')
      await expect(prismaTeste.time.count()).resolves.toBe(1)
    })

    it('ATLETA não escreve → 403 em POST, PATCH e DELETE (critério 17)', async () => {
      const time = await timeProprio()
      const api = await como('ATLETA')
      const respostas = [
        await api.post({ nome: 'Golfe', modalidadeId: futsalId }),
        await api.patch(time.id, { ativo: false }),
        await api.delete(time.id),
      ]
      expect(respostas.map(({ status }) => status)).toEqual([403, 403, 403])
    })

    it('sem token → 401 em todas as rotas (critério 17)', async () => {
      const time = await timeProprio()
      const http = contexto.http
      const respostas = await Promise.all([
        request(http).get(ROTA),
        request(http).get(`${ROTA}/${time.id}`),
        request(http).post(ROTA).send({ nome: 'Golfe', modalidadeId: futsalId }),
        request(http).patch(`${ROTA}/${time.id}`).send({ ativo: false }),
        request(http).delete(`${ROTA}/${time.id}`),
      ])
      for (const resposta of respostas) {
        expect(resposta.status).toBe(401)
        expect(erro(resposta).code).toBe('UNAUTHENTICATED')
      }
    })

    it('time de outra atlética que usa o app → 404 em GET, PATCH e DELETE (critério 18)', async () => {
      const outra = await criarAtletica()
      const alheio = await criarTime({ atleticaId: outra.id, modalidadeId: futsalId })
      const diretor = await como('DIRETOR')
      const presidente = await como('PRESIDENTE')

      const respostas = [
        await diretor.get(`/${alheio.id}`),
        await diretor.patch(alheio.id, { ativo: false }),
        await presidente.delete(alheio.id),
      ]
      expect(respostas.map(({ status }) => status)).toEqual([404, 404, 404])
      expect(listaTimesSchema.parse((await diretor.get('?incluirInativos=true')).body).total).toBe(
        0,
      )
      await expect(
        prismaTeste.time.findUniqueOrThrow({ where: { id: alheio.id } }),
      ).resolves.toMatchObject({ ativo: true })
    })
  })
})
