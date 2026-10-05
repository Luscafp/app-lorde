import { listaModalidadesSchema, modalidadeSchema, type Papel } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { AuditoriaService } from '../../src/modules/auditoria/auditoria.service'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarModalidade } from '../fabricas/modalidades'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

// Modalidade é global (convenções §9): não há caso "outra atlética → 404".
const ROTA = '/api/v1/modalidades'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

describe('/modalidades (#15)', () => {
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

  const usuario = (papel: Papel = 'ATLETA') => criarUsuario({ papel, atleticaId })

  async function como(papel: Papel | UsuarioCriado) {
    const alvo = typeof papel === 'string' ? await usuario(papel) : papel
    const auth = `Bearer ${await tokenPara(alvo)}`
    const http = contexto.http
    return {
      get: (consulta = '') => request(http).get(`${ROTA}${consulta}`).set('Authorization', auth),
      post: (corpo: object) => request(http).post(ROTA).set('Authorization', auth).send(corpo),
      patch: (id: string, corpo: object) =>
        request(http).patch(`${ROTA}/${id}`).set('Authorization', auth).send(corpo),
      delete: (id: string) => request(http).delete(`${ROTA}/${id}`).set('Authorization', auth),
    }
  }

  const registros = () =>
    prismaTeste.registroAuditoria.findMany({
      where: { entidade: 'Modalidade' },
      orderBy: { criadoEm: 'asc' },
    })

  function criarTime(modalidadeId: string, dados: { atleticaId?: string; ativo?: boolean } = {}) {
    return prismaTeste.time.create({
      data: { atleticaId: dados.atleticaId ?? atleticaId, modalidadeId, nome: 'Time', ...dados },
    })
  }

  describe('GET', () => {
    beforeEach(async () => {
      await criarModalidade({ nome: 'Xadrez', ativa: false })
      await criarModalidade({ nome: 'vôlei' })
      await criarModalidade({ nome: 'Futsal' })
    })

    it('ATLETA vê só as ativas, em ordem alfabética (critério 1)', async () => {
      const resposta = await (await como('ATLETA')).get()
      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const { items } = listaModalidadesSchema.parse(resposta.body)
      expect(items.map(({ nome }) => nome)).toEqual(['Futsal', 'vôlei'])
    })

    it('ATLETA com incluirInativas=true: parâmetro ignorado (critério 2)', async () => {
      const resposta = await (await como('ATLETA')).get('?incluirInativas=true')
      expect(resposta.status).toBe(200)
      expect(listaModalidadesSchema.parse(resposta.body).items).toHaveLength(2)
    })

    it('DIRETOR com incluirInativas=true recebe também as inativas (critério 3)', async () => {
      const resposta = await (await como('DIRETOR')).get('?incluirInativas=true')
      const { items } = listaModalidadesSchema.parse(resposta.body)
      expect(items.map(({ nome, ativa }) => [nome, ativa])).toEqual([
        ['Futsal', true],
        ['vôlei', true],
        ['Xadrez', false],
      ])
    })

    it('incluirInativas inválido → 400', async () => {
      const resposta = await (await como('DIRETOR')).get('?incluirInativas=sim')
      expect(resposta.status).toBe(400)
      expect(erro(resposta).details[0]?.field).toBe('incluirInativas')
    })
  })

  describe('POST', () => {
    it('DIRETOR cadastra: 201 ativa e auditoria MODALIDADE_CRIADA (critério 4)', async () => {
      const diretor = await usuario('DIRETOR')
      const resposta = await (await como(diretor)).post({ nome: 'Handebol', icone: 'handball' })

      expect(resposta.status).toBe(201)
      const criada = modalidadeSchema.parse(resposta.body)
      expect(criada).toMatchObject({ nome: 'Handebol', icone: 'handball', ativa: true })
      const [registro, ...outros] = await registros()
      expect(outros).toHaveLength(0)
      expect(registro).toMatchObject({
        acao: 'MODALIDADE_CRIADA',
        entidadeId: criada.id,
        usuarioId: diretor.id,
        atleticaId,
        dados: { antes: null, depois: { nome: 'Handebol', icone: 'handball', ativa: true } },
      })
    })

    it('normaliza espaços e acusa duplicado sem diferenciar maiúsculas (critério 5)', async () => {
      await criarModalidade({ nome: 'Futsal' })
      const resposta = await (await como('DIRETOR')).post({ nome: ' futsal ', icone: 'soccer' })
      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('MODALIDADE_DUPLICADA')
      expect(erro(resposta).details[0]?.field).toBe('nome')
    })

    it.each([
      ['nome curto', { nome: 'A', icone: 'soccer' }, 'nome'],
      ['nome longo', { nome: 'x'.repeat(41), icone: 'soccer' }, 'nome'],
      ['ícone fora do catálogo', { nome: 'Futsal', icone: '⚽' }, 'icone'],
      ['campo extra', { nome: 'Futsal', icone: 'soccer', ativa: false }, ''],
    ])('%s → 400 sem gravar (critério 6)', async (_caso, corpo, campo) => {
      const resposta = await (await como('DIRETOR')).post(corpo)
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      expect(erro(resposta).details[0]?.field).toBe(campo)
      await expect(prismaTeste.modalidade.count()).resolves.toBe(0)
    })

    it('dois POST simultâneos com o mesmo nome → um 201 e um 409', async () => {
      const api = await como('DIRETOR')
      const respostas = await Promise.all([
        api.post({ nome: 'Rugby', icone: 'rugby' }),
        api.post({ nome: 'RUGBY', icone: 'rugby' }),
      ])
      expect(respostas.map(({ status }) => status).sort()).toEqual([201, 409])
      expect(respostas.find(({ status }) => status === 409)?.body).toMatchObject({
        code: 'MODALIDADE_DUPLICADA',
      })
      await expect(prismaTeste.modalidade.count()).resolves.toBe(1)
      await expect(registros()).resolves.toHaveLength(1)
    })

    it('falha na auditoria desfaz o cadastro', async () => {
      const espiao = jest
        .spyOn(contexto.app.get(AuditoriaService), 'registrar')
        .mockRejectedValueOnce(new Error('falha simulada'))
      const resposta = await (await como('DIRETOR')).post({ nome: 'Golfe', icone: 'golf' })
      espiao.mockRestore()

      expect(resposta.status).toBe(500)
      await expect(prismaTeste.modalidade.count()).resolves.toBe(0)
    })
  })

  describe('PATCH', () => {
    it('desativar some da lista do ATLETA e audita MODALIDADE_DESATIVADA (critério 7)', async () => {
      const futsal = await criarModalidade({ nome: 'Futsal' })
      const resposta = await (await como('DIRETOR')).patch(futsal.id, { ativa: false })

      expect(resposta.status).toBe(200)
      expect(modalidadeSchema.parse(resposta.body).ativa).toBe(false)
      const lista = await (await como('ATLETA')).get()
      expect(listaModalidadesSchema.parse(lista.body).items).toEqual([])
      const [registro] = await registros()
      expect(registro).toMatchObject({
        acao: 'MODALIDADE_DESATIVADA',
        dados: { antes: { ativa: true }, depois: { ativa: false } },
      })
    })

    it('altera nome e ícone com MODALIDADE_ALTERADA só dos campos alterados', async () => {
      const futsal = await criarModalidade({ nome: 'futsal', icone: 'soccer' })
      const resposta = await (
        await como('DIRETOR')
      ).patch(futsal.id, {
        nome: 'Futsal',
        icone: 'soccer',
      })
      expect(resposta.status).toBe(200)
      expect(resposta.body).toMatchObject({ nome: 'Futsal', icone: 'soccer' })
      const [registro] = await registros()
      expect(registro).toMatchObject({
        acao: 'MODALIDADE_ALTERADA',
        dados: { antes: { nome: 'futsal' }, depois: { nome: 'Futsal' } },
      })
    })

    it('sem mudança → 200 sem auditoria', async () => {
      const futsal = await criarModalidade({ nome: 'Futsal' })
      const resposta = await (await como('DIRETOR')).patch(futsal.id, { ativa: true })
      expect(resposta.status).toBe(200)
      await expect(registros()).resolves.toHaveLength(0)
    })

    it('nome de outra modalidade → 409', async () => {
      await criarModalidade({ nome: 'Vôlei' })
      const futsal = await criarModalidade({ nome: 'Futsal' })
      const resposta = await (await como('DIRETOR')).patch(futsal.id, { nome: 'VÔLEI' })
      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('MODALIDADE_DUPLICADA')
    })

    it('corpo vazio → 400', async () => {
      const futsal = await criarModalidade()
      const resposta = await (await como('DIRETOR')).patch(futsal.id, {})
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
    })

    it('id inexistente → 404; malformado → 400 (critério 13)', async () => {
      const api = await como('DIRETOR')
      const inexistente = await api.patch(ID_INEXISTENTE, { ativa: false })
      expect(inexistente.status).toBe(404)
      expect(erro(inexistente).code).toBe('NOT_FOUND')
      const malformado = await api.patch('abc', { ativa: false })
      expect(malformado.status).toBe(400)
      expect(erro(malformado).details[0]?.field).toBe('id')
    })
  })

  describe('DELETE', () => {
    it.each(['PRESIDENTE', 'VICE_PRESIDENTE', 'ADMINISTRADOR'] as Papel[])(
      '%s exclui modalidade sem times: 204, remoção física e auditoria (critério 8)',
      async (papel) => {
        const futsal = await criarModalidade({ nome: 'Futsal', icone: 'soccer' })
        const resposta = await (await como(papel)).delete(futsal.id)

        expect(resposta.status).toBe(204)
        await expect(prismaTeste.modalidade.count()).resolves.toBe(0)
        const [registro] = await registros()
        expect(registro).toMatchObject({
          acao: 'MODALIDADE_EXCLUIDA',
          entidadeId: futsal.id,
          dados: { antes: { nome: 'Futsal', icone: 'soccer', ativa: true }, depois: null },
        })
      },
    )

    it.each([
      ['time ativo da atlética', {}],
      ['time inativo', { ativo: false }],
      ['time de adversária', 'adversaria'],
      ['time de outra atlética com app', 'outra'],
    ] as const)('com %s → 409 e nada muda (critério 9)', async (_caso, dados) => {
      const futsal = await criarModalidade()
      if (dados === 'adversaria' || dados === 'outra') {
        const dona = await criarAtletica({ usaAplicativo: dados === 'outra' })
        await criarTime(futsal.id, { atleticaId: dona.id })
      } else {
        await criarTime(futsal.id, dados)
      }

      const resposta = await (await como('PRESIDENTE')).delete(futsal.id)
      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('MODALIDADE_COM_DEPENDENCIAS')
      await expect(prismaTeste.modalidade.count()).resolves.toBe(1)
      await expect(registros()).resolves.toHaveLength(0)
    })

    it('inexistente → 404; malformado → 400 (critério 13)', async () => {
      const api = await como('PRESIDENTE')
      expect((await api.delete(ID_INEXISTENTE)).status).toBe(404)
      expect((await api.delete('abc')).status).toBe(400)
    })
  })

  describe('autorização', () => {
    it('DIRETOR não exclui → 403 (critério 10)', async () => {
      const futsal = await criarModalidade()
      const resposta = await (await como('DIRETOR')).delete(futsal.id)
      expect(resposta.status).toBe(403)
      expect(erro(resposta).code).toBe('FORBIDDEN')
      await expect(prismaTeste.modalidade.count()).resolves.toBe(1)
    })

    it('ATLETA não escreve → 403 em POST, PATCH e DELETE (critério 11)', async () => {
      const futsal = await criarModalidade()
      const api = await como('ATLETA')
      const respostas = [
        await api.post({ nome: 'Golfe', icone: 'golf' }),
        await api.patch(futsal.id, { ativa: false }),
        await api.delete(futsal.id),
      ]
      expect(respostas.map(({ status }) => status)).toEqual([403, 403, 403])
    })

    it('sem token → 401 em todas as rotas (critério 12)', async () => {
      const futsal = await criarModalidade()
      const http = contexto.http
      const respostas = await Promise.all([
        request(http).get(ROTA),
        request(http).post(ROTA).send({ nome: 'Golfe', icone: 'golf' }),
        request(http).patch(`${ROTA}/${futsal.id}`).send({ ativa: false }),
        request(http).delete(`${ROTA}/${futsal.id}`),
      ])
      for (const resposta of respostas) {
        expect(resposta.status).toBe(401)
        expect(erro(resposta).code).toBe('UNAUTHENTICATED')
      }
    })
  })
})
