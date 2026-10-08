import { listaNoticiasSchema, noticiaDetalheSchema, type Papel } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarNoticia, type DadosNoticia } from '../fabricas/noticias'
import { criarUsuario } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

// Qualquer papel lê (convenções §9): não há caso 403.
const ROTA = '/api/v1/noticias'
const BASE_PUBLICA = 'https://imagens.teste.local'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro
const minutosAtras = (minutos: number) => new Date(Date.now() - minutos * 60_000)

describe('/noticias (#78)', () => {
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

  async function como(papel: Papel = 'ATLETA') {
    const auth = `Bearer ${await tokenPara(await criarUsuario({ papel, atleticaId }))}`
    return {
      listar: (consulta = '') =>
        request(contexto.http).get(`${ROTA}${consulta}`).set('Authorization', auth),
      detalhar: (id: string) =>
        request(contexto.http).get(`${ROTA}/${id}`).set('Authorization', auth),
    }
  }

  const noticia = (dados: Partial<DadosNoticia> = {}) => criarNoticia({ atleticaId, ...dados })

  describe('sem token → 401 (critério 15)', () => {
    it.each([ROTA, `${ROTA}/${ID_INEXISTENTE}`])('GET %s', async (rota) => {
      const resposta = await request(contexto.http).get(rota)
      expect(resposta.status).toBe(401)
      expect(erro(resposta).code).toBe('UNAUTHENTICATED')
    })
  })

  describe('GET /noticias', () => {
    it('só publicadas da atlética, mais recente primeiro, com total (critério 8, RN24)', async () => {
      const antiga = await noticia({ publicadaEm: minutosAtras(30) })
      const recente = await noticia({ publicadaEm: minutosAtras(5) })
      await noticia({ status: 'RASCUNHO' })
      await noticia({ publicadaEm: minutosAtras(1), excluidoEm: new Date() })
      const outra = (await criarAtletica()).id
      await criarNoticia({ atleticaId: outra, publicadaEm: minutosAtras(1) })

      const resposta = await (await como()).listar()

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const corpo = listaNoticiasSchema.parse(resposta.body)
      expect(corpo.items.map(({ id }) => id)).toEqual([recente.id, antiga.id])
      expect(corpo).toMatchObject({ page: 1, limit: 20, total: 2 })
    })

    it('mesma publicadaEm desempata por id decrescente', async () => {
      const publicadaEm = minutosAtras(10)
      const ids = [
        (await noticia({ publicadaEm })).id,
        (await noticia({ publicadaEm })).id,
        (await noticia({ publicadaEm })).id,
      ]
      const { items } = listaNoticiasSchema.parse((await (await como()).listar()).body)
      expect(items.map(({ id }) => id)).toEqual([...ids].sort().reverse())
    })

    it('45 publicadas → páginas de 20, 20 e 5 (critério 17)', async () => {
      const autorId = (await criarUsuario({ papel: 'DIRETOR', atleticaId })).id
      await prismaTeste.noticia.createMany({
        data: Array.from({ length: 45 }, (_, i) => ({
          atleticaId,
          autorId,
          titulo: `Notícia ${i}`,
          status: 'PUBLICADA' as const,
          publicadaEm: minutosAtras(i),
        })),
      })
      const cliente = await como()

      const paginas = await Promise.all(
        [1, 2, 3].map(async (page) =>
          listaNoticiasSchema.parse((await cliente.listar(`?page=${page}&limit=20`)).body),
        ),
      )

      expect(paginas.map(({ items }) => items.length)).toEqual([20, 20, 5])
      expect(paginas.every(({ total }) => total === 45)).toBe(true)
      const titulos = paginas.flatMap(({ items }) => items.map(({ titulo }) => titulo))
      expect(new Set(titulos).size).toBe(45)
      expect(titulos[0]).toBe('Notícia 0')
      expect(titulos[44]).toBe('Notícia 44')
    })

    it('imagemCapaUrl montada da chave; resumo sem Markdown', async () => {
      const key = `atleticas/${atleticaId}/noticias/autor/capa.jpg`
      await noticia({
        imagemCapaKey: key,
        conteudo: 'A equipe **venceu** a [final](https://x.com).',
      })
      await noticia({ publicadaEm: minutosAtras(1) })

      const { items } = listaNoticiasSchema.parse((await (await como()).listar()).body)

      expect(items[0]).toMatchObject({
        imagemCapaUrl: `${BASE_PUBLICA}/${key}`,
        resumo: 'A equipe venceu a final.',
      })
      expect(items[1]?.imagemCapaUrl).toBeNull()
    })

    it('sem notícias publicadas → lista vazia', async () => {
      await noticia({ status: 'RASCUNHO' })
      const corpo = listaNoticiasSchema.parse((await (await como()).listar()).body)
      expect(corpo).toEqual({ items: [], page: 1, limit: 20, total: 0 })
    })

    it.each(['?limit=51', '?page=0', '?limit=0', '?page=abc', '?tagId=1'])(
      '%s → 400 VALIDATION_ERROR (critério 16)',
      async (consulta) => {
        const resposta = await (await como()).listar(consulta)
        expect(resposta.status).toBe(400)
        expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      },
    )
  })

  describe('GET /noticias/:id', () => {
    it.each<Papel>(['ATLETA', 'DIRETOR', 'ADMINISTRADOR'])(
      '%s lê a publicada com o conteúdo em Markdown',
      async (papel) => {
        const key = `atleticas/${atleticaId}/noticias/autor/capa.png`
        const criada = await noticia({ conteudo: '**Campeões!**\n\n- vôlei', imagemCapaKey: key })

        const resposta = await (await como(papel)).detalhar(criada.id)

        expect(resposta.status).toBe(200)
        expect(resposta.headers['cache-control']).toBe('no-store')
        expect(noticiaDetalheSchema.parse(resposta.body)).toEqual({
          id: criada.id,
          titulo: criada.titulo,
          conteudo: '**Campeões!**\n\n- vôlei',
          imagemCapaUrl: `${BASE_PUBLICA}/${key}`,
          publicadaEm: criada.publicadaEm?.toISOString(),
          tags: [],
        })
      },
    )

    it.each([
      ['rascunho', { status: 'RASCUNHO' as const }],
      ['excluída', { excluidoEm: new Date() }],
    ])('%s → 404 (critério 9)', async (_, dados) => {
      const criada = await noticia(dados)
      const resposta = await (await como()).detalhar(criada.id)
      expect(resposta.status).toBe(404)
      expect(erro(resposta).code).toBe('NOT_FOUND')
    })

    it('de outra atlética → 404, igual à inexistente', async () => {
      const alheia = await criarNoticia({ atleticaId: (await criarAtletica()).id })
      const cliente = await como()
      const [deOutra, inexistente] = await Promise.all([
        cliente.detalhar(alheia.id),
        cliente.detalhar(ID_INEXISTENTE),
      ])
      expect(deOutra.status).toBe(404)
      expect(deOutra.body).toEqual(inexistente.body)
    })

    it('id não-UUID → 400 VALIDATION_ERROR', async () => {
      const resposta = await (await como()).detalhar('abc')
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
    })
  })

  describe('publicada e depois retirada', () => {
    it.each([
      ['excluída', { excluidoEm: new Date() }],
      ['despublicada', { status: 'RASCUNHO' as const }],
    ])('%s some da lista e o detalhe responde 404', async (_, mudanca) => {
      const criada = await noticia()
      const cliente = await como()
      expect((await cliente.detalhar(criada.id)).status).toBe(200)

      await prismaTeste.noticia.update({ where: { id: criada.id }, data: mudanca })

      const lista = listaNoticiasSchema.parse((await cliente.listar()).body)
      expect(lista.items).toEqual([])
      expect(lista.total).toBe(0)
      expect((await cliente.detalhar(criada.id)).status).toBe(404)
    })
  })
})
