import {
  listaNoticiasPainelSchema,
  listaNoticiasSchema,
  listaTagsSchema,
  noticiaDetalheSchema,
  noticiaPainelDetalheSchema,
  type Papel,
} from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarNoticia } from '../fabricas/noticias'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const PAINEL = '/api/v1/painel/noticias'
const NOTICIAS = '/api/v1/noticias'
const TAGS = '/api/v1/tags'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro
const detalhe = (resposta: { body: unknown }) => noticiaPainelDetalheSchema.parse(resposta.body)
const nomes = (tags: { nome: string }[]) => tags.map(({ nome }) => nome)

describe('Tags de notícias (#32)', () => {
  let contexto: AppDeTeste
  let atleticaId: string
  let diretor: UsuarioCriado

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica()).id
    diretor = await criarUsuario({ papel: 'DIRETOR', atleticaId })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  async function como(usuario: UsuarioCriado = diretor) {
    const auth = `Bearer ${await tokenPara(usuario)}`
    const get = (rota: string) => request(contexto.http).get(rota).set('Authorization', auth)
    return {
      get,
      criar: (corpo: object) =>
        request(contexto.http).post(PAINEL).set('Authorization', auth).send(corpo),
      atualizar: (id: string, corpo: object) =>
        request(contexto.http).patch(`${PAINEL}/${id}`).set('Authorization', auth).send(corpo),
      tags: (consulta = '') => get(`${TAGS}${consulta}`),
      publicas: (consulta = '') => get(`${NOTICIAS}${consulta}`),
    }
  }

  const papel = (p: Papel) => criarUsuario({ papel: p, atleticaId })
  const tagsNoBanco = (id = atleticaId) =>
    prismaTeste.tag.findMany({ where: { atleticaId: id }, orderBy: { nomeNormalizado: 'asc' } })
  const publicar = (id: string) =>
    prismaTeste.noticia.update({
      where: { id },
      data: { status: 'PUBLICADA', publicadaEm: new Date() },
    })

  async function criarComTags(tags: string[], publicada = true) {
    const resposta = await (await como()).criar({ titulo: `Notícia ${tags.join(' ')}`, tags })
    expect(resposta.status).toBe(201)
    const criada = detalhe(resposta)
    if (publicada) await publicar(criada.id)
    return criada
  }

  describe('banco (#43)', () => {
    it('nomeNormalizado é único por atlética; outra atlética pode repetir', async () => {
      const outra = (await criarAtletica()).id
      await prismaTeste.tag.create({
        data: { atleticaId, nome: 'Vôlei', nomeNormalizado: 'volei' },
      })
      await expect(
        prismaTeste.tag.create({ data: { atleticaId, nome: 'Volei', nomeNormalizado: 'volei' } }),
      ).rejects.toMatchObject({ code: 'P2002' })
      await expect(
        prismaTeste.tag.create({
          data: { atleticaId: outra, nome: 'Vôlei', nomeNormalizado: 'volei' },
        }),
      ).resolves.toBeDefined()
    })
  })

  describe('escrita pelo Painel', () => {
    it('cria as tags na atlética ativa e devolve id e nome (critério 1)', async () => {
      const resposta = await (
        await como()
      ).criar({ titulo: 'Seletiva', tags: ['Futsal', 'Seletiva'] })

      expect(resposta.status).toBe(201)
      const criada = detalhe(resposta)
      expect(nomes(criada.tags)).toEqual(['Futsal', 'Seletiva'])
      expect((await tagsNoBanco()).map(({ id, nome }) => ({ id, nome }))).toEqual(criada.tags)
    })

    it('reaproveita a tag sem diferenciar espaços, caixa e acento (critérios 2 e 3)', async () => {
      const primeira = await criarComTags(['Futsal', 'Vôlei'])
      const segunda = await criarComTags([' futsal ', 'VOLEI', 'volei'])

      expect(segunda.tags).toEqual(primeira.tags)
      expect(nomes(segunda.tags)).toEqual(['Futsal', 'Vôlei'])
      expect(await tagsNoBanco()).toHaveLength(2)
    })

    it.each([
      [['aa', 'bb', 'cc', 'dd', 'ee', 'ff'], 'tags'],
      [['a'], 'tags.0'],
      [['Futsal', 'x'.repeat(31)], 'tags.1'],
      [['<b>'], 'tags.0'],
    ])('%j → 400 com details em %s (critério 4)', async (tags, campo) => {
      const resposta = await (await como()).criar({ titulo: 'Seletiva', tags })

      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      expect(erro(resposta).details.map(({ field }) => field)).toContain(campo)
      expect(await tagsNoBanco()).toEqual([])
    })

    it('PATCH substitui o conjunto; sem tags mantém; [] remove (critério 5)', async () => {
      const criada = await criarComTags(['Futsal', 'Seletiva'], false)
      const api = await como()

      const trocada = detalhe(await api.atualizar(criada.id, { tags: ['Resultados'] }))
      expect(nomes(trocada.tags)).toEqual(['Resultados'])

      const mantida = detalhe(await api.atualizar(criada.id, { titulo: 'Outro título' }))
      expect(nomes(mantida.tags)).toEqual(['Resultados'])

      const vazia = detalhe(await api.atualizar(criada.id, { tags: [] }))
      expect(vazia.tags).toEqual([])
      expect(await prismaTeste.noticiaTag.count({ where: { noticiaId: criada.id } })).toBe(0)
      expect(await tagsNoBanco()).toHaveLength(3)
    })

    it('auditoria registra só os ids das tags; mudança só de tags gera NOTICIA_ALTERADA', async () => {
      const criada = await criarComTags(['Futsal'], false)
      const [futsal] = criada.tags
      const atualizada = detalhe(await (await como()).atualizar(criada.id, { tags: ['Seletiva'] }))
      const [seletiva] = atualizada.tags

      const registros = await prismaTeste.registroAuditoria.findMany({
        where: { entidadeId: criada.id },
        orderBy: { criadoEm: 'asc' },
      })
      expect(registros.map(({ acao, dados }) => [acao, dados])).toEqual([
        [
          'NOTICIA_CRIADA',
          {
            antes: null,
            depois: { titulo: criada.titulo, status: 'RASCUNHO', tagIds: [futsal?.id] },
          },
        ],
        [
          'NOTICIA_ALTERADA',
          { antes: { tagIds: [futsal?.id] }, depois: { tagIds: [seletiva?.id] } },
        ],
      ])
    })

    it('mesma tag nova em paralelo → ambas 201 e uma única Tag (critério 6)', async () => {
      const api = await como()
      const respostas = await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          api.criar({ titulo: `Notícia ${i}`, tags: ['Calouros'] }),
        ),
      )

      expect(respostas.map(({ status }) => status)).toEqual([201, 201, 201, 201])
      expect(await tagsNoBanco()).toHaveLength(1)
      expect(new Set(respostas.map((r) => detalhe(r).tags[0]?.id)).size).toBe(1)
    })

    it('Atleta enviando tags → 403, sem criar tags (critério 13)', async () => {
      const api = await como(await papel('ATLETA'))
      const resposta = await api.criar({ titulo: 'Seletiva', tags: ['Futsal'] })
      expect(resposta.status).toBe(403)
      expect(erro(resposta).code).toBe('FORBIDDEN')
      expect(await tagsNoBanco()).toEqual([])
    })

    it('notícia de outra atlética → 404, sem criar tags', async () => {
      const alheia = await criarNoticia({ atleticaId: (await criarAtletica()).id })
      const resposta = await (await como()).atualizar(alheia.id, { tags: ['Futsal'] })
      expect(resposta.status).toBe(404)
      expect(await tagsNoBanco()).toEqual([])
    })

    it('GET /painel/noticias?tagId= filtra por tag, inclusive rascunhos', async () => {
      const rascunho = await criarComTags(['Calouros'], false)
      await criarComTags(['Futsal'])
      const [calouros] = rascunho.tags

      const lista = listaNoticiasPainelSchema.parse(
        (await (await como()).get(`${PAINEL}?tagId=${calouros?.id}`)).body,
      )
      expect(lista.items.map(({ id }) => id)).toEqual([rascunho.id])
      expect(lista.items[0]?.tags).toEqual(rascunho.tags)
    })
  })

  describe('GET /tags', () => {
    it('sem token → 401 (critério 13)', async () => {
      const resposta = await request(contexto.http).get(TAGS)
      expect(resposta.status).toBe(401)
      expect(erro(resposta).code).toBe('UNAUTHENTICATED')
    })

    it('Atleta vê só as tags em uso por publicadas, mesmo com emUso=false (critérios 7 e 8)', async () => {
      await criarComTags(['Futsal', 'Seletiva'])
      await criarComTags(['Futsal'])
      await criarComTags(['Calouros'], false)
      const excluida = await criarComTags(['Excluída'])
      await prismaTeste.noticia.update({
        where: { id: excluida.id },
        data: { excluidoEm: new Date() },
      })
      const api = await como(await papel('ATLETA'))

      for (const consulta of ['', '?emUso=false']) {
        const resposta = await api.tags(consulta)
        expect(resposta.status).toBe(200)
        expect(resposta.headers['cache-control']).toBe('no-store')
        const lista = listaTagsSchema.parse(resposta.body)
        expect(lista.items.map(({ nome, totalNoticias }) => [nome, totalNoticias])).toEqual([
          ['Futsal', 2],
          ['Seletiva', 1],
        ])
        expect(lista.total).toBe(2)
      }
    })

    it('Diretor com emUso=false busca sem acento nem caixa (autocomplete, critério 8)', async () => {
      await criarComTags(['Calouros', 'Cálculo'], false)
      await criarComTags(['Futsal'])
      const api = await como()

      const busca = listaTagsSchema.parse((await api.tags('?emUso=false&q=CAL')).body)
      expect(busca.items.map(({ nome, totalNoticias }) => [nome, totalNoticias])).toEqual([
        ['Cálculo', 0],
        ['Calouros', 0],
      ])
      const emUso = listaTagsSchema.parse((await api.tags()).body)
      expect(nomes(emUso.items)).toEqual(['Futsal'])
    })

    it('pagina em ordem de nome e não mostra tags de outra atlética', async () => {
      await criarComTags(['Delta', 'Alfa', 'Charlie', 'Bravo'], false)
      const outra = (await criarAtletica()).id
      await prismaTeste.tag.create({
        data: { atleticaId: outra, nome: 'Aaa', nomeNormalizado: 'aaa' },
      })
      const api = await como()

      const pagina = listaTagsSchema.parse((await api.tags('?emUso=false&limit=2&page=2')).body)
      expect(pagina).toMatchObject({ page: 2, limit: 2, total: 4 })
      expect(nomes(pagina.items)).toEqual(['Charlie', 'Delta'])
    })

    it.each(['?emUso=sim', '?limit=51', `?q=${'x'.repeat(31)}`, '?nome=x'])(
      '%s → 400 VALIDATION_ERROR',
      async (consulta) => {
        const resposta = await (await como()).tags(consulta)
        expect(resposta.status).toBe(400)
        expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      },
    )
  })

  describe('leitura pública', () => {
    it('lista e detalhe trazem as tags ordenadas por nome', async () => {
      const criada = await criarComTags(['Vôlei', 'Final', 'Atlética'])
      const api = await como(await papel('ATLETA'))

      const lista = listaNoticiasSchema.parse((await api.publicas()).body)
      expect(nomes(lista.items[0]?.tags ?? [])).toEqual(['Atlética', 'Final', 'Vôlei'])
      const aberta = noticiaDetalheSchema.parse((await api.get(`${NOTICIAS}/${criada.id}`)).body)
      expect(nomes(aberta.tags)).toEqual(['Atlética', 'Final', 'Vôlei'])
    })

    it('?tagId= filtra só publicadas com a tag, paginadas (critério 9)', async () => {
      const futsal = await criarComTags(['Futsal'])
      await criarComTags(['Vôlei'])
      await criarComTags(['Futsal'], false)
      const [tag] = futsal.tags
      const api = await como(await papel('ATLETA'))

      const lista = listaNoticiasSchema.parse((await api.publicas(`?tagId=${tag?.id}`)).body)
      expect(lista.items.map(({ id }) => id)).toEqual([futsal.id])
      expect(lista).toMatchObject({ page: 1, limit: 20, total: 1 })
    })

    it('?tagId= de tag usada só em rascunho → lista vazia (RN24)', async () => {
      const rascunho = await criarComTags(['Calouros'], false)
      const [tag] = rascunho.tags
      const api = await como(await papel('ATLETA'))

      const resposta = await api.publicas(`?tagId=${tag?.id}`)
      expect(resposta.status).toBe(200)
      expect(listaNoticiasSchema.parse(resposta.body)).toMatchObject({ items: [], total: 0 })
    })

    it('despublicada some do filtro e a tag sai de /tags (critério 10)', async () => {
      const criada = await criarComTags(['Futsal'])
      const [tag] = criada.tags
      await prismaTeste.noticia.update({ where: { id: criada.id }, data: { status: 'RASCUNHO' } })
      const api = await como(await papel('ATLETA'))

      const lista = listaNoticiasSchema.parse((await api.publicas(`?tagId=${tag?.id}`)).body)
      expect(lista).toMatchObject({ items: [], total: 0 })
      expect(listaTagsSchema.parse((await api.tags()).body).items).toEqual([])
    })

    it('tagId inexistente ou de outra atlética → 200 com lista vazia (critério 12)', async () => {
      await criarComTags(['Futsal'])
      const alheia = await prismaTeste.tag.create({
        data: { atleticaId: (await criarAtletica()).id, nome: 'Futsal', nomeNormalizado: 'futsal' },
      })
      const api = await como(await papel('ATLETA'))

      for (const tagId of [alheia.id, ID_INEXISTENTE]) {
        const resposta = await api.publicas(`?tagId=${tagId}`)
        expect(resposta.status).toBe(200)
        expect(listaNoticiasSchema.parse(resposta.body)).toMatchObject({ items: [], total: 0 })
      }
    })
  })
})
