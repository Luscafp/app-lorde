import { DeleteObjectCommand, HeadObjectCommand, NotFound } from '@aws-sdk/client-s3'
import {
  bannerPainelSchema,
  bannersOrdenadosSchema,
  listaBannersPainelSchema,
  listaBannersSchema,
  type Papel,
} from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { AuditoriaService } from '../../src/modules/auditoria/auditoria.service'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { chaveDeBanner, criarBanner, type DadosBanner } from '../fabricas/banners'
import {
  comandosEnviados,
  simularArmazenamento,
  type ArmazenamentoSimulado,
} from '../fabricas/uploads'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/painel/banners'
const ROTA_PUBLICA = '/api/v1/banners'
const BASE_PUBLICA = 'https://imagens.teste.local'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro
const banner = (resposta: { body: unknown }) => bannerPainelSchema.parse(resposta.body)

type Metodo = 'get' | 'post' | 'patch' | 'put' | 'delete'

const rotasComId = (id: string): [Metodo, string, object?][] => [
  ['get', `${ROTA}/${id}`],
  ['patch', `${ROTA}/${id}`, { titulo: 'Título novo' }],
  ['delete', `${ROTA}/${id}`],
]

describe('/banners e /painel/banners (#33)', () => {
  let contexto: AppDeTeste
  let armazenamento: ArmazenamentoSimulado
  let atleticaId: string
  let diretor: UsuarioCriado

  beforeAll(async () => {
    armazenamento = simularArmazenamento()
    contexto = await criarApp({ ajustar: armazenamento.ajustar })
  })

  beforeEach(async () => {
    armazenamento.s3.send.mockClear()
    atleticaId = (await criarAtletica()).id
    diretor = await criarUsuario({ papel: 'DIRETOR', atleticaId })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  async function como(usuario: UsuarioCriado = diretor) {
    const auth = `Bearer ${await tokenPara(usuario)}`
    const enviar = (metodo: Metodo, rota: string, corpo?: object) => {
      const req = request(contexto.http)[metodo](rota).set('Authorization', auth)
      return corpo ? req.send(corpo) : req
    }
    return {
      enviar,
      home: () => enviar('get', ROTA_PUBLICA),
      listar: () => enviar('get', ROTA),
      criar: (corpo: object) => enviar('post', ROTA, corpo),
      atualizar: (id: string, corpo: object) => enviar('patch', `${ROTA}/${id}`, corpo),
      ordenar: (ids: string[]) => enviar('put', `${ROTA}/ordem`, { ids }),
      excluir: (id: string) => enviar('delete', `${ROTA}/${id}`),
    }
  }

  const usuario = (papel: Papel) => criarUsuario({ papel, atleticaId })
  const imagem = (dono: UsuarioCriado = diretor) => chaveDeBanner(atleticaId, dono.id)
  const novo = (dados: Partial<DadosBanner> = {}) => criarBanner({ atleticaId, ...dados })
  const idsNaHome = async () =>
    listaBannersSchema.parse((await (await como()).home()).body).items.map(({ id }) => id)
  const auditoria = () =>
    prismaTeste.registroAuditoria.findMany({
      where: { entidade: 'Banner' },
      orderBy: { criadoEm: 'asc' },
    })
  const consultasAoR2 = () => comandosEnviados(armazenamento.s3.send, HeadObjectCommand)

  describe('autenticação, papel e escopo', () => {
    it.each([
      ['get', ROTA_PUBLICA],
      ['get', ROTA],
      ['post', ROTA],
      ['put', `${ROTA}/ordem`],
      ...rotasComId(ID_INEXISTENTE),
    ] as [Metodo, string][])('sem token: %s %s → 401', async (metodo, rota) => {
      const resposta = await request(contexto.http)[metodo](rota)
      expect(resposta.status).toBe(401)
      expect(erro(resposta).code).toBe('UNAUTHENTICATED')
    })

    it('Atleta → 403 em todas as rotas do Painel, sem alterar nada (critério 12)', async () => {
      const existente = await novo()
      const api = await como(await usuario('ATLETA'))
      const rotas: [Metodo, string, object?][] = [
        ['get', ROTA],
        ['post', ROTA, { titulo: 'JUBS', imagemKey: imagem() }],
        ['put', `${ROTA}/ordem`, { ids: [existente.id] }],
        ...rotasComId(existente.id),
      ]
      for (const [metodo, rota, corpo] of rotas) {
        const resposta = await api.enviar(metodo, rota, corpo)
        expect([metodo, rota, resposta.status, erro(resposta).code]).toEqual([
          metodo,
          rota,
          403,
          'FORBIDDEN',
        ])
      }
      expect(await prismaTeste.banner.findUnique({ where: { id: existente.id } })).toMatchObject({
        titulo: existente.titulo,
      })
    })

    it('Diretor não exclui → 403 (critério 10)', async () => {
      const existente = await novo()
      const resposta = await (await como()).excluir(existente.id)
      expect(resposta.status).toBe(403)
      expect(await prismaTeste.banner.count()).toBe(1)
    })

    it.each([
      ['de outra atlética', async () => criarBanner({ atleticaId: (await criarAtletica()).id })],
      ['inexistente', () => Promise.resolve({ id: ID_INEXISTENTE })],
    ])('%s → 404 em todas as rotas com id (critério 13)', async (_, criar) => {
      const { id } = await criar()
      const api = await como(await usuario('PRESIDENTE'))
      for (const [metodo, rota, corpo] of rotasComId(id)) {
        const resposta = await api.enviar(metodo, rota, corpo)
        expect([metodo, resposta.status, erro(resposta).code]).toEqual([metodo, 404, 'NOT_FOUND'])
      }
    })
  })

  describe('GET /banners', () => {
    it('só ativos da atlética, por ordem (critério 1)', async () => {
      const dois = await novo({ ordem: 2 })
      const zero = await novo({ ordem: 0, link: 'https://exemplo.com' })
      const um = await novo({ ordem: 1 })
      await novo({ ordem: 3, ativo: false })
      await criarBanner({ atleticaId: (await criarAtletica()).id, ordem: 0 })

      const resposta = await (await como(await usuario('ATLETA'))).home()

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const { items } = listaBannersSchema.parse(resposta.body)
      expect(items.map(({ id }) => id)).toEqual([zero.id, um.id, dois.id])
      expect(items[0]).toEqual({
        id: zero.id,
        titulo: zero.titulo,
        imagemUrl: `${BASE_PUBLICA}/${zero.imagemKey}`,
        link: 'https://exemplo.com',
      })
    })

    it('nenhum ativo → lista vazia (critério 4)', async () => {
      await novo({ ativo: false })
      expect(await idsNaHome()).toEqual([])
    })
  })

  describe('POST /painel/banners', () => {
    it('sem link: 201 no fim da ordem, auditado e na Home (critério 6)', async () => {
      await novo({ ordem: 7 })
      const key = imagem()

      const resposta = await (await como()).criar({ titulo: '  Inscrições JUBS ', imagemKey: key })

      expect(resposta.status).toBe(201)
      const criado = banner(resposta)
      expect(criado).toMatchObject({
        titulo: 'Inscrições JUBS',
        imagemUrl: `${BASE_PUBLICA}/${key}`,
        link: null,
        ordem: 8,
        ativo: true,
      })
      expect(consultasAoR2().map(({ input }) => input.Key)).toEqual([key])
      expect(
        (await auditoria()).map(({ acao, entidadeId, usuarioId, dados }) => ({
          acao,
          entidadeId,
          usuarioId,
          dados,
        })),
      ).toEqual([
        {
          acao: 'BANNER_CRIADO',
          entidadeId: criado.id,
          usuarioId: diretor.id,
          dados: {
            antes: null,
            depois: { titulo: 'Inscrições JUBS', link: null, ordem: 8, ativo: true },
          },
        },
      ])
      expect(await idsNaHome()).toContain(criado.id)
    })

    it.each(['http://exemplo.com', 'javascript:alert(1)'])(
      'link %j → 400 VALIDATION_ERROR no campo link (critério 5)',
      async (link) => {
        const resposta = await (await como()).criar({ titulo: 'JUBS', imagemKey: imagem(), link })
        expect(resposta.status).toBe(400)
        expect(erro(resposta)).toMatchObject({
          code: 'VALIDATION_ERROR',
          details: [{ field: 'link', message: 'O link deve começar com https://' }],
        })
        expect(await prismaTeste.banner.count()).toBe(0)
      },
    )

    it.each([
      ['de perfil', (id: string) => `usuarios/${id}/perfil/a.jpg`],
      ['de outra atlética', (id: string) => chaveDeBanner(ID_INEXISTENTE, id)],
      ['de outro usuário', () => chaveDeBanner(atleticaId, ID_INEXISTENTE)],
    ])('imagem %s → 422 UPLOAD_INVALIDO (critério 7)', async (_, chave) => {
      const resposta = await (await como()).criar({ titulo: 'JUBS', imagemKey: chave(diretor.id) })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('UPLOAD_INVALIDO')
      expect(await prismaTeste.banner.count()).toBe(0)
    })

    it('objeto inexistente no R2 → 422 UPLOAD_NAO_ENCONTRADO (critério 7)', async () => {
      armazenamento.s3.send.mockRejectedValueOnce(
        new NotFound({ message: 'NotFound', $metadata: { httpStatusCode: 404 } }),
      )
      const resposta = await (await como()).criar({ titulo: 'JUBS', imagemKey: imagem() })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('UPLOAD_NAO_ENCONTRADO')
    })

    it('11º ativo → 409 LIMITE_BANNERS_ATIVOS; inativo é aceito (critério 14)', async () => {
      for (let i = 0; i < 10; i++) await novo()
      const api = await como()

      const ativo = await api.criar({ titulo: 'JUBS', imagemKey: imagem() })
      expect(ativo.status).toBe(409)
      expect(erro(ativo).code).toBe('LIMITE_BANNERS_ATIVOS')

      const inativo = await api.criar({ titulo: 'JUBS', imagemKey: imagem(), ativo: false })
      expect(inativo.status).toBe(201)
    })

    it('criações simultâneas não repetem a ordem', async () => {
      const api = await como()
      const respostas = await Promise.all(
        Array.from({ length: 4 }, () => api.criar({ titulo: 'JUBS', imagemKey: imagem() })),
      )
      expect(respostas.map(({ status }) => status)).toEqual([201, 201, 201, 201])
      const ordens = respostas.map((resposta) => banner(resposta).ordem).sort()
      expect(ordens).toEqual([0, 1, 2, 3])
    })

    it('falha na auditoria desfaz o cadastro', async () => {
      const espiao = jest
        .spyOn(contexto.app.get(AuditoriaService), 'registrar')
        .mockRejectedValueOnce(new Error('falha simulada'))
      const resposta = await (await como()).criar({ titulo: 'JUBS', imagemKey: imagem() })
      espiao.mockRestore()

      expect(resposta.status).toBe(500)
      expect(await prismaTeste.banner.count()).toBe(0)
    })
  })

  describe('GET /painel/banners', () => {
    it('ativos e inativos da atlética, por ordem, paginado', async () => {
      const inativo = await novo({ ordem: 0, ativo: false })
      const ativo = await novo({ ordem: 1 })
      await criarBanner({ atleticaId: (await criarAtletica()).id })

      const resposta = await (await como()).listar()

      expect(resposta.status).toBe(200)
      const corpo = listaBannersPainelSchema.parse(resposta.body)
      expect(corpo).toMatchObject({ page: 1, limit: 20, total: 2 })
      expect(corpo.items.map(({ id, ativo }) => [id, ativo])).toEqual([
        [inativo.id, false],
        [ativo.id, true],
      ])
    })
  })

  describe('PATCH /painel/banners/:id', () => {
    it('desativar: some da Home, continua no Painel e audita (critério 9)', async () => {
      const existente = await novo()

      const resposta = await (await como()).atualizar(existente.id, { ativo: false })

      expect(resposta.status).toBe(200)
      expect(banner(resposta).ativo).toBe(false)
      expect(await idsNaHome()).toEqual([])
      expect((await auditoria()).map(({ acao, dados }) => [acao, dados])).toEqual([
        ['BANNER_ALTERADO', { antes: { ativo: true }, depois: { ativo: false } }],
      ])
    })

    it('sem mudança efetiva: 200, sem auditoria nem validarKey (critério 16)', async () => {
      const existente = await novo()
      const resposta = await (
        await como()
      ).atualizar(existente.id, {
        titulo: existente.titulo,
        imagemKey: existente.imagemKey,
      })
      expect(resposta.status).toBe(200)
      expect(await auditoria()).toEqual([])
      expect(consultasAoR2()).toEqual([])
    })

    it('troca a imagem: valida a nova, remove a anterior e audita só o indicador', async () => {
      const existente = await novo()
      const key = imagem()

      const resposta = await (await como()).atualizar(existente.id, { imagemKey: key })

      expect(resposta.status).toBe(200)
      expect(banner(resposta).imagemUrl).toBe(`${BASE_PUBLICA}/${key}`)
      expect(consultasAoR2().map(({ input }) => input.Key)).toEqual([key])
      expect(
        comandosEnviados(armazenamento.s3.send, DeleteObjectCommand).map(({ input }) => input.Key),
      ).toEqual([existente.imagemKey])
      const [registro] = await auditoria()
      expect(registro?.dados).toEqual({ antes: {}, depois: { imagemAlterada: true } })
    })

    it('link http → 400; link null remove', async () => {
      const existente = await novo({ link: 'https://exemplo.com' })
      const api = await como()

      const invalido = await api.atualizar(existente.id, { link: 'http://exemplo.com' })
      expect(invalido.status).toBe(400)
      expect(erro(invalido).details[0]?.field).toBe('link')

      const removido = await api.atualizar(existente.id, { link: null })
      expect(banner(removido).link).toBeNull()
    })

    it('ativar o 11º → 409', async () => {
      for (let i = 0; i < 10; i++) await novo()
      const inativo = await novo({ ativo: false })
      const resposta = await (await como()).atualizar(inativo.id, { ativo: true })
      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('LIMITE_BANNERS_ATIVOS')
    })

    it('corpo vazio → 400', async () => {
      const existente = await novo()
      const resposta = await (await como()).atualizar(existente.id, {})
      expect(resposta.status).toBe(400)
    })
  })

  describe('PUT /painel/banners/ordem', () => {
    it('último para o topo: Home reflete e há um único BANNER_REORDENADO (critério 8)', async () => {
      const a = await novo({ ordem: 0 })
      const b = await novo({ ordem: 1, ativo: false })
      const c = await novo({ ordem: 2 })

      const resposta = await (await como()).ordenar([c.id, a.id, b.id])

      expect(resposta.status).toBe(200)
      const { items } = bannersOrdenadosSchema.parse(resposta.body)
      expect(items.map(({ id, ordem }) => [id, ordem])).toEqual([
        [c.id, 0],
        [a.id, 1],
        [b.id, 2],
      ])
      expect(await idsNaHome()).toEqual([c.id, a.id])
      expect(
        (await auditoria()).map(({ acao, entidadeId, dados }) => [acao, entidadeId, dados]),
      ).toEqual([
        [
          'BANNER_REORDENADO',
          c.id,
          { antes: { ids: [a.id, b.id, c.id] }, depois: { ids: [c.id, a.id, b.id] } },
        ],
      ])
    })

    it.each([
      ['faltando um', (ids: string[]) => ids.slice(1)],
      ['repetido', (ids: string[]) => [ids[0], ...ids.slice(0, -1)]],
      ['com id de outra atlética', (ids: string[], alheio: string) => [...ids.slice(1), alheio]],
    ])('lista %s → 400 ORDEM_INCOMPLETA', async (_, montar) => {
      const ids = [(await novo()).id, (await novo()).id]
      const alheio = (await criarBanner({ atleticaId: (await criarAtletica()).id })).id

      const resposta = await (await como()).ordenar(montar(ids, alheio) as string[])

      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('ORDEM_INCOMPLETA')
      expect(await auditoria()).toEqual([])
    })
  })

  describe('DELETE /painel/banners/:id', () => {
    it('Presidência: 204, exclusão física, auditado; a imagem fica no R2 (critério 11)', async () => {
      const existente = await novo()

      const resposta = await (await como(await usuario('PRESIDENTE'))).excluir(existente.id)

      expect(resposta.status).toBe(204)
      expect(await prismaTeste.banner.count()).toBe(0)
      expect(await idsNaHome()).toEqual([])
      expect(
        (await auditoria()).map(({ acao, entidadeId, dados }) => [acao, entidadeId, dados]),
      ).toEqual([
        [
          'BANNER_EXCLUIDO',
          existente.id,
          {
            antes: { titulo: existente.titulo, link: null, ordem: existente.ordem, ativo: true },
            depois: null,
          },
        ],
      ])
      expect(comandosEnviados(armazenamento.s3.send, DeleteObjectCommand)).toEqual([])
    })
  })
})
