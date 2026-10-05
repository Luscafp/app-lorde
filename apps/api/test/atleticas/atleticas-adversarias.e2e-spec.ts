import {
  atleticaAdversariaDtoSchema,
  listaAtleticasAdversariasSchema,
  type Papel,
} from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { AuditoriaService } from '../../src/modules/auditoria/auditoria.service'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarAtleticaAdversaria, criarTimeAdversario } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/atleticas-adversarias'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

describe('/atleticas-adversarias (#63)', () => {
  let contexto: AppDeTeste
  let atleticaId: string

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica()).id
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  async function como(papel: Papel | UsuarioCriado) {
    const alvo = typeof papel === 'string' ? await criarUsuario({ papel, atleticaId }) : papel
    const auth = `Bearer ${await tokenPara(alvo)}`
    const http = contexto.http
    return {
      get: (consulta = '') => request(http).get(`${ROTA}${consulta}`).set('Authorization', auth),
      post: (corpo: object) => request(http).post(ROTA).set('Authorization', auth).send(corpo),
      patch: (id: string, corpo: object) =>
        request(http).patch(`${ROTA}/${id}`).set('Authorization', auth).send(corpo),
    }
  }

  const registros = () =>
    prismaTeste.registroAuditoria.findMany({
      where: { entidade: 'Atletica' },
      orderBy: { criadoEm: 'asc' },
    })

  const adversarias = () => prismaTeste.atletica.count({ where: { usaAplicativo: false } })

  describe('GET', () => {
    it('lista só adversárias, por nome, com totalTimes, busca sem acento e paginação', async () => {
      const fenix = await criarAtleticaAdversaria({ nome: 'Atlética Fênix', sigla: 'FNX' })
      await criarAtleticaAdversaria({ nome: 'Atlética Águia' })
      await criarTimeAdversario({ atleticaId: fenix.id })
      await criarTimeAdversario({ atleticaId: fenix.id })
      const api = await como('DIRETOR')

      const resposta = await api.get()
      expect(resposta.status).toBe(200)
      const lista = listaAtleticasAdversariasSchema.parse(resposta.body)
      expect(lista.total).toBe(2)
      expect(lista.items.map(({ nome, totalTimes }) => [nome, totalTimes])).toEqual([
        ['Atlética Águia', 0],
        ['Atlética Fênix', 2],
      ])

      const busca = listaAtleticasAdversariasSchema.parse((await api.get('?q=fen')).body)
      expect(busca.items).toEqual([
        { id: fenix.id, nome: 'Atlética Fênix', sigla: 'FNX', curso: null, totalTimes: 2 },
      ])

      const pagina = listaAtleticasAdversariasSchema.parse((await api.get('?limit=1&page=2')).body)
      expect(pagina).toMatchObject({ page: 2, limit: 1, total: 2 })
      expect(pagina.items.map(({ nome }) => nome)).toEqual(['Atlética Fênix'])
    })
  })

  describe('POST', () => {
    it('DIRETOR cadastra: 201, usaAplicativo = false e ATLETICA_ADVERSARIA_CRIADA', async () => {
      const diretor = await criarUsuario({ papel: 'DIRETOR', atleticaId })
      const resposta = await (
        await como(diretor)
      ).post({
        nome: ' Atlética  Fênix ',
        sigla: 'fnx',
        curso: 'Engenharia',
      })

      expect(resposta.status).toBe(201)
      const criada = atleticaAdversariaDtoSchema.parse(resposta.body)
      expect(criada).toMatchObject({
        nome: 'Atlética Fênix',
        sigla: 'FNX',
        curso: 'Engenharia',
        totalTimes: 0,
      })
      await expect(
        prismaTeste.atletica.findUniqueOrThrow({ where: { id: criada.id } }),
      ).resolves.toMatchObject({ usaAplicativo: false })
      const [registro] = await registros()
      expect(registro).toMatchObject({
        acao: 'ATLETICA_ADVERSARIA_CRIADA',
        entidadeId: criada.id,
        usuarioId: diretor.id,
        dados: {
          antes: null,
          depois: { nome: 'Atlética Fênix', sigla: 'FNX', curso: 'Engenharia' },
        },
      })
    })

    it('mesmo nome sem diferenciar caixa → 409 ATLETICA_DUPLICADA', async () => {
      const api = await como('DIRETOR')
      expect((await api.post({ nome: 'Atlética Fênix' })).status).toBe(201)
      const resposta = await api.post({ nome: 'atlética fênix' })
      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('ATLETICA_DUPLICADA')
      expect(erro(resposta).details[0]?.field).toBe('nome')
    })

    it('nome igual ao da atlética que usa o app é aceito (unicidade só entre adversárias)', async () => {
      const propria = await prismaTeste.atletica.findUniqueOrThrow({ where: { id: atleticaId } })
      const resposta = await (await como('DIRETOR')).post({ nome: propria.nome })
      expect(resposta.status).toBe(201)
    })

    it('dois POST simultâneos com o mesmo nome → um 201 e um 409', async () => {
      const api = await como('DIRETOR')
      const respostas = await Promise.all([
        api.post({ nome: 'Atlética Leão' }),
        api.post({ nome: 'ATLÉTICA LEÃO' }),
      ])
      expect(respostas.map(({ status }) => status).sort()).toEqual([201, 409])
      await expect(adversarias()).resolves.toBe(1)
    })

    it('usaAplicativo no corpo → 400', async () => {
      const resposta = await (await como('DIRETOR')).post({ nome: 'Fênix', usaAplicativo: true })
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      await expect(adversarias()).resolves.toBe(0)
    })

    it('falha na auditoria desfaz o cadastro', async () => {
      const espiao = jest
        .spyOn(contexto.app.get(AuditoriaService), 'registrar')
        .mockRejectedValueOnce(new Error('falha simulada'))
      const resposta = await (await como('DIRETOR')).post({ nome: 'Fênix' })
      espiao.mockRestore()

      expect(resposta.status).toBe(500)
      await expect(adversarias()).resolves.toBe(0)
    })
  })

  describe('PATCH', () => {
    it('altera e audita só os campos alterados', async () => {
      const fenix = await criarAtleticaAdversaria({ nome: 'Fênix', sigla: 'FNX' })
      const resposta = await (
        await como('DIRETOR')
      ).patch(fenix.id, { sigla: null, curso: 'Direito' })

      expect(resposta.status).toBe(200)
      expect(atleticaAdversariaDtoSchema.parse(resposta.body)).toMatchObject({
        sigla: null,
        curso: 'Direito',
      })
      const [registro] = await registros()
      expect(registro).toMatchObject({
        acao: 'ATLETICA_ADVERSARIA_ALTERADA',
        dados: { antes: { sigla: 'FNX', curso: null }, depois: { sigla: null, curso: 'Direito' } },
      })
    })

    it('sem mudança → 200 sem auditoria; mudar só a caixa do próprio nome é aceito', async () => {
      const fenix = await criarAtleticaAdversaria({ nome: 'Fênix' })
      const api = await como('DIRETOR')
      expect((await api.patch(fenix.id, { nome: 'Fênix' })).status).toBe(200)
      await expect(registros()).resolves.toHaveLength(0)
      expect((await api.patch(fenix.id, { nome: 'FÊNIX' })).status).toBe(200)
    })

    it('nome de outra adversária → 409', async () => {
      await criarAtleticaAdversaria({ nome: 'Leão' })
      const fenix = await criarAtleticaAdversaria({ nome: 'Fênix' })
      const resposta = await (await como('DIRETOR')).patch(fenix.id, { nome: 'leão' })
      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('ATLETICA_DUPLICADA')
    })

    it('atlética que usa o app ou inexistente → 404; malformado → 400', async () => {
      const api = await como('DIRETOR')
      const outra = await criarAtletica()
      for (const id of [atleticaId, outra.id, ID_INEXISTENTE]) {
        const resposta = await api.patch(id, { nome: 'Invasora' })
        expect(resposta.status).toBe(404)
        expect(erro(resposta).code).toBe('NOT_FOUND')
      }
      expect((await api.patch('abc', { nome: 'X' })).status).toBe(400)
      await expect(registros()).resolves.toHaveLength(0)
    })
  })

  describe('autorização', () => {
    it('ATLETA → 403 em todas as rotas', async () => {
      const fenix = await criarAtleticaAdversaria()
      const api = await como('ATLETA')
      const respostas = [
        await api.get(),
        await api.post({ nome: 'Fênix' }),
        await api.patch(fenix.id, { nome: 'X' }),
      ]
      expect(respostas.map(({ status }) => status)).toEqual([403, 403, 403])
    })

    it('sem token → 401 em todas as rotas', async () => {
      const fenix = await criarAtleticaAdversaria()
      const http = contexto.http
      const respostas = await Promise.all([
        request(http).get(ROTA),
        request(http).post(ROTA).send({ nome: 'Fênix' }),
        request(http).patch(`${ROTA}/${fenix.id}`).send({ nome: 'X' }),
      ])
      for (const resposta of respostas) {
        expect(resposta.status).toBe(401)
        expect(erro(resposta).code).toBe('UNAUTHENTICATED')
      }
    })
  })
})
