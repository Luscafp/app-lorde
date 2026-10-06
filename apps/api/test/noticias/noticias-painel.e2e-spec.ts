import { DeleteObjectCommand, HeadObjectCommand, NotFound } from '@aws-sdk/client-s3'
import {
  listaNoticiasPainelSchema,
  listaNoticiasSchema,
  noticiaPainelDetalheSchema,
  type Papel,
} from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { chaveDeCapa, criarNoticia, type DadosNoticia } from '../fabricas/noticias'
import {
  comandosEnviados,
  simularArmazenamento,
  type ArmazenamentoSimulado,
} from '../fabricas/uploads'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/painel/noticias'
const ROTA_PUBLICA = '/api/v1/noticias'
const BASE_PUBLICA = 'https://imagens.teste.local'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro
const detalhe = (resposta: { body: unknown }) => noticiaPainelDetalheSchema.parse(resposta.body)

type Metodo = 'get' | 'post' | 'patch' | 'delete'

/** Todas as rotas do Painel para um id, com um corpo válido. */
const rotasSemId: [Metodo, string, object?][] = [
  ['get', ROTA],
  ['post', ROTA, { titulo: 'Seletiva' }],
]

const rotasComId = (id: string): [Metodo, string, object?][] => [
  ['get', `${ROTA}/${id}`],
  ['patch', `${ROTA}/${id}`, { titulo: 'Título novo' }],
  ['post', `${ROTA}/${id}/publicar`],
  ['post', `${ROTA}/${id}/despublicar`],
  ['delete', `${ROTA}/${id}`],
]

describe('/painel/noticias (#80)', () => {
  let contexto: AppDeTeste
  let armazenamento: ArmazenamentoSimulado
  let eventos: EspiaoEventos
  let atleticaId: string
  let diretor: UsuarioCriado

  beforeAll(async () => {
    armazenamento = simularArmazenamento()
    contexto = await criarApp({ ajustar: armazenamento.ajustar })
  })

  beforeEach(async () => {
    armazenamento.s3.send.mockClear()
    eventos = espiarEventos(contexto.app)
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
      listar: (consulta = '') => enviar('get', `${ROTA}${consulta}`),
      detalhar: (id: string) => enviar('get', `${ROTA}/${id}`),
      criar: (corpo: object) => enviar('post', ROTA, corpo),
      atualizar: (id: string, corpo: object) => enviar('patch', `${ROTA}/${id}`, corpo),
      publicar: (id: string) => enviar('post', `${ROTA}/${id}/publicar`),
      despublicar: (id: string) => enviar('post', `${ROTA}/${id}/despublicar`),
      excluir: (id: string) => enviar('delete', `${ROTA}/${id}`),
      publicas: () => enviar('get', ROTA_PUBLICA),
      publica: (id: string) => enviar('get', `${ROTA_PUBLICA}/${id}`),
    }
  }

  const usuario = (papel: Papel) => criarUsuario({ papel, atleticaId })
  const capa = (dono: UsuarioCriado = diretor) => chaveDeCapa(atleticaId, dono.id)
  const noticia = (dados: Partial<DadosNoticia> = {}) =>
    criarNoticia({ atleticaId, autorId: diretor.id, ...dados })
  const rascunhoCompleto = (dados: Partial<DadosNoticia> = {}) =>
    noticia({ status: 'RASCUNHO', imagemCapaKey: capa(), ...dados })
  const noBanco = (id: string) => prismaTeste.noticia.findUniqueOrThrow({ where: { id } })
  const auditoria = (entidadeId: string) =>
    prismaTeste.registroAuditoria.findMany({ where: { entidadeId }, orderBy: { criadoEm: 'asc' } })
  const publicadas = async () => {
    await aguardarOuvintes()
    return eventos.emitidos().filter(({ nome }) => nome === 'noticia.publicada')
  }
  const consultasAoR2 = () => comandosEnviados(armazenamento.s3.send, HeadObjectCommand)

  describe('autenticação, papel e escopo (critério 12)', () => {
    it.each([...rotasSemId, ...rotasComId(ID_INEXISTENTE)])(
      'sem token: %s %s → 401',
      async (metodo, rota) => {
        const resposta = await request(contexto.http)[metodo](rota)
        expect(resposta.status).toBe(401)
        expect(erro(resposta).code).toBe('UNAUTHENTICATED')
      },
    )

    it('Atleta → 403 em todas as rotas, sem alterar nada', async () => {
      const existente = await rascunhoCompleto()
      const api = await como(await usuario('ATLETA'))
      for (const [metodo, rota, corpo] of [...rotasSemId, ...rotasComId(existente.id)]) {
        const resposta = await api.enviar(metodo, rota, corpo)
        expect([rota, resposta.status, erro(resposta).code]).toEqual([rota, 403, 'FORBIDDEN'])
      }
      expect(await noBanco(existente.id)).toMatchObject({ status: 'RASCUNHO', excluidoEm: null })
    })

    it.each([
      ['de outra atlética', async () => criarNoticia({ atleticaId: (await criarAtletica()).id })],
      ['excluída', async () => noticia({ excluidoEm: new Date() })],
      ['inexistente', () => Promise.resolve({ id: ID_INEXISTENTE })],
    ])('%s → 404 em todas as rotas', async (_, criar) => {
      const { id } = await criar()
      const api = await como(await usuario('PRESIDENTE'))
      for (const [metodo, rota, corpo] of rotasComId(id)) {
        const resposta = await api.enviar(metodo, rota, corpo)
        expect([metodo, resposta.status, erro(resposta).code]).toEqual([metodo, 404, 'NOT_FOUND'])
      }
    })

    it('id não-UUID → 400', async () => {
      const resposta = await (await como()).detalhar('abc')
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
    })
  })

  describe('POST /painel/noticias', () => {
    it('rascunho mínimo: 201, autor = Diretor, fora da leitura pública (critério 1)', async () => {
      const api = await como()

      const resposta = await api.criar({ titulo: 'Seletiva de futsal' })

      expect(resposta.status).toBe(201)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const criada = detalhe(resposta)
      expect(criada).toMatchObject({
        titulo: 'Seletiva de futsal',
        conteudo: '',
        status: 'RASCUNHO',
        publicadaEm: null,
        imagemCapaUrl: null,
        autor: { id: diretor.id, nome: diretor.nome },
      })
      expect(listaNoticiasSchema.parse((await api.publicas()).body).total).toBe(0)
      expect((await auditoria(criada.id)).map(({ acao, dados }) => [acao, dados])).toEqual([
        [
          'NOTICIA_CRIADA',
          { antes: null, depois: { titulo: 'Seletiva de futsal', status: 'RASCUNHO' } },
        ],
      ])
      expect(await publicadas()).toEqual([])
    })

    it('com publicar: true nasce publicada e emite o evento (critério 4)', async () => {
      const key = capa()
      const resposta = await (
        await como()
      ).criar({
        titulo: 'Seletiva',
        conteudo: 'Inscrições abertas.',
        imagemCapaKey: key,
        publicar: true,
      })

      expect(resposta.status).toBe(201)
      const criada = detalhe(resposta)
      expect(criada).toMatchObject({ status: 'PUBLICADA', imagemCapaUrl: `${BASE_PUBLICA}/${key}` })
      expect(criada.publicadaEm).not.toBeNull()
      expect((await auditoria(criada.id)).map(({ acao, dados }) => [acao, dados])).toEqual([
        ['NOTICIA_CRIADA', { antes: null, depois: { titulo: 'Seletiva', status: 'PUBLICADA' } }],
        ['NOTICIA_PUBLICADA', expect.objectContaining({ contexto: { primeiraPublicacao: true } })],
      ])
      expect((await publicadas()).map(({ payload }) => payload)).toEqual([
        { atleticaId, noticiaId: criada.id, autorId: diretor.id },
      ])
    })

    it.each([
      ['sem capa', 'Texto', false, 'CAPA_OBRIGATORIA'],
      ['com conteúdo em branco', '   ', true, 'CONTEUDO_OBRIGATORIO'],
    ])('publicar: true %s → 422 %s', async (_, conteudo, comCapa, code) => {
      const imagemCapaKey = comCapa ? capa() : undefined
      const resposta = await (
        await como()
      ).criar({ titulo: 'Seletiva', publicar: true, conteudo, imagemCapaKey })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe(code)
      expect(await prismaTeste.noticia.count()).toBe(0)
    })

    it('rascunho com conteúdo vazio é aceito (critério 18)', async () => {
      const resposta = await (await como()).criar({ titulo: 'Seletiva', conteudo: '' })
      expect(resposta.status).toBe(201)
      expect((await noBanco(detalhe(resposta).id)).conteudo).toBe('')
    })

    it.each([
      ['título com 2', { titulo: 'ab' }, 'titulo'],
      ['título com 121', { titulo: 'x'.repeat(121) }, 'titulo'],
      ['conteúdo com 10 001', { titulo: 'Seletiva', conteudo: 'x'.repeat(10_001) }, 'conteudo'],
      ['status no corpo', { titulo: 'Seletiva', status: 'PUBLICADA' }, ''],
    ])('%s → 400 VALIDATION_ERROR (critério 13)', async (_, corpo, campo) => {
      const resposta = await (await como()).criar(corpo)
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      if (campo) expect(erro(resposta).details.map(({ field }) => field)).toEqual([campo])
    })

    it.each([
      ['título com 3', { titulo: 'abc' }],
      ['título com 120', { titulo: 'x'.repeat(120) }],
      ['conteúdo com 10 000', { titulo: 'Seletiva', conteudo: 'x'.repeat(10_000) }],
    ])('%s → 201', async (_, corpo) => {
      expect((await (await como()).criar(corpo)).status).toBe(201)
    })

    it.each([
      ['de outra atlética', async () => chaveDeCapa((await criarAtletica()).id, diretor.id)],
      [
        'da finalidade PERFIL',
        () => Promise.resolve(`usuarios/${diretor.id}/perfil/${ID_INEXISTENTE}.jpg`),
      ],
      ['de outro usuário', async () => capa(await usuario('DIRETOR'))],
    ])('capa %s → 422 UPLOAD_INVALIDO (critério 14)', async (_, chave) => {
      const resposta = await (
        await como()
      ).criar({ titulo: 'Seletiva', imagemCapaKey: await chave() })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('UPLOAD_INVALIDO')
      expect(await prismaTeste.noticia.count()).toBe(0)
    })

    it('objeto da capa inexistente no R2 → 422 UPLOAD_NAO_ENCONTRADO (critério 14)', async () => {
      armazenamento.s3.send.mockRejectedValueOnce(
        new NotFound({ message: 'NotFound', $metadata: { httpStatusCode: 404 } }),
      )
      const resposta = await (await como()).criar({ titulo: 'Seletiva', imagemCapaKey: capa() })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('UPLOAD_NAO_ENCONTRADO')
    })
  })

  describe('GET /painel/noticias', () => {
    it('rascunhos e publicadas não excluídas da atlética, por atualizadoEm desc', async () => {
      const antiga = await noticia({ atualizadoEm: new Date(Date.now() - 60_000) })
      const rascunho = await noticia({ status: 'RASCUNHO' })
      await noticia({ excluidoEm: new Date() })
      await criarNoticia({ atleticaId: (await criarAtletica()).id })

      const resposta = await (await como()).listar()

      expect(resposta.status).toBe(200)
      const corpo = listaNoticiasPainelSchema.parse(resposta.body)
      expect(corpo.items.map(({ id }) => id)).toEqual([rascunho.id, antiga.id])
      expect(corpo).toMatchObject({ page: 1, limit: 20, total: 2 })
      expect(corpo.items[0]).toMatchObject({ status: 'RASCUNHO', autor: { id: diretor.id } })
    })

    it('filtro por status e busca sem acento nem caixa (critério 16)', async () => {
      const alvo = await noticia({
        status: 'RASCUNHO',
        titulo: 'Inscrições para a SELETIVA de vôlei',
      })
      await noticia({ titulo: 'Seletiva publicada' })
      await noticia({ status: 'RASCUNHO', titulo: 'Outro assunto' })
      await noticia({ status: 'RASCUNHO', titulo: 'Seletiva 100% garantida' })

      const api = await como()
      const busca = listaNoticiasPainelSchema.parse(
        (await api.listar('?status=RASCUNHO&q=inscricoes%20para%20a%20selet')).body,
      )
      expect(busca.items.map(({ id }) => id)).toEqual([alvo.id])
      const curinga = listaNoticiasPainelSchema.parse((await api.listar('?q=0%25%20g')).body)
      expect(curinga.items.map(({ titulo }) => titulo)).toEqual(['Seletiva 100% garantida'])
      expect(listaNoticiasPainelSchema.parse((await api.listar('?q=%25')).body).total).toBe(1)
    })

    it('paginação de 20 por padrão', async () => {
      await prismaTeste.noticia.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          atleticaId,
          autorId: diretor.id,
          titulo: `Notícia ${i}`,
        })),
      })
      const api = await como()
      const [primeira, segunda] = await Promise.all(
        ['', '?page=2'].map(async (consulta) =>
          listaNoticiasPainelSchema.parse((await api.listar(consulta)).body),
        ),
      )
      expect([primeira?.items.length, segunda?.items.length]).toEqual([20, 5])
      expect(primeira?.total).toBe(25)
    })

    it.each(['?status=EXCLUIDA', '?limit=51', '?autorId=x'])('%s → 400', async (consulta) => {
      expect((await (await como()).listar(consulta)).status).toBe(400)
    })
  })

  describe('GET /painel/noticias/:id', () => {
    it('rascunho completo, com conteúdo e autor', async () => {
      const criada = await rascunhoCompleto({ conteudo: '**Texto**' })
      const resposta = await (await como()).detalhar(criada.id)
      expect(resposta.status).toBe(200)
      expect(detalhe(resposta)).toMatchObject({
        id: criada.id,
        conteudo: '**Texto**',
        status: 'RASCUNHO',
        autor: { id: diretor.id, nome: diretor.nome },
      })
    })
  })

  describe('publicar e despublicar', () => {
    it('rascunho completo → publicada, visível e com um evento (critério 2)', async () => {
      const criada = await rascunhoCompleto()
      const api = await como()

      const resposta = await api.publicar(criada.id)

      expect(resposta.status).toBe(200)
      expect(detalhe(resposta)).toMatchObject({ status: 'PUBLICADA' })
      expect(detalhe(resposta).publicadaEm).not.toBeNull()
      expect((await api.publica(criada.id)).status).toBe(200)
      expect((await publicadas()).map(({ payload }) => payload)).toEqual([
        { atleticaId, noticiaId: criada.id, autorId: diretor.id },
      ])
      expect(consultasAoR2()).toEqual([])
    })

    it.each([
      [{ imagemCapaKey: null }, 'CAPA_OBRIGATORIA'],
      [{ conteudo: ' \n ' }, 'CONTEUDO_OBRIGATORIO'],
    ])('rascunho %j → 422 %s e o status não muda (critério 3)', async (dados, code) => {
      const criada = await rascunhoCompleto(dados)
      const resposta = await (await como()).publicar(criada.id)
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe(code)
      expect((await noBanco(criada.id)).status).toBe('RASCUNHO')
      expect(await publicadas()).toEqual([])
    })

    it('despublicar some da leitura pública; republicar mantém a data e não notifica (7 e 8)', async () => {
      const criada = await rascunhoCompleto()
      const api = await como()
      const { publicadaEm } = detalhe(await api.publicar(criada.id))

      const despublicada = await api.despublicar(criada.id)
      expect(despublicada.status).toBe(200)
      expect(detalhe(despublicada)).toMatchObject({ status: 'RASCUNHO', publicadaEm })
      expect(listaNoticiasSchema.parse((await api.publicas()).body).total).toBe(0)
      expect((await api.publica(criada.id)).status).toBe(404)

      const republicada = await api.publicar(criada.id)
      expect(detalhe(republicada)).toMatchObject({ status: 'PUBLICADA', publicadaEm })
      expect(await publicadas()).toHaveLength(1)
      expect((await auditoria(criada.id)).map(({ acao }) => acao)).toEqual([
        'NOTICIA_PUBLICADA',
        'NOTICIA_DESPUBLICADA',
        'NOTICIA_PUBLICADA',
      ])
    })

    it('publicar publicada e despublicar rascunho são idempotentes, sem auditoria', async () => {
      const publicada = await noticia()
      const rascunho = await rascunhoCompleto()
      const api = await como()

      expect(detalhe(await api.publicar(publicada.id)).status).toBe('PUBLICADA')
      expect(detalhe(await api.despublicar(rascunho.id)).status).toBe('RASCUNHO')
      expect(await prismaTeste.registroAuditoria.count()).toBe(0)
      expect(await publicadas()).toEqual([])
    })

    it('dois Diretores publicando juntos: ambos 200 e um evento só (critério 9)', async () => {
      const criada = await rascunhoCompleto()
      const [a, b] = await Promise.all([como(), como(await usuario('DIRETOR'))])

      const respostas = await Promise.all([a.publicar(criada.id), b.publicar(criada.id)])

      expect(respostas.map(({ status }) => status)).toEqual([200, 200])
      expect(await publicadas()).toHaveLength(1)
      expect(
        await prismaTeste.registroAuditoria.count({ where: { acao: 'NOTICIA_PUBLICADA' } }),
      ).toBe(1)
    })
  })

  describe('PATCH /painel/noticias/:id', () => {
    it('publicada: edita o título, mantém status e data, sem evento (critério 5)', async () => {
      const criada = await noticia({ imagemCapaKey: capa() })
      const resposta = await (await como()).atualizar(criada.id, { titulo: 'Título corrigido' })

      expect(resposta.status).toBe(200)
      expect(detalhe(resposta)).toMatchObject({
        titulo: 'Título corrigido',
        status: 'PUBLICADA',
        publicadaEm: criada.publicadaEm?.toISOString(),
      })
      expect(await publicadas()).toEqual([])
      const [registro] = await auditoria(criada.id)
      expect(registro).toMatchObject({
        acao: 'NOTICIA_ALTERADA',
        usuarioId: diretor.id,
        dados: { antes: { titulo: criada.titulo }, depois: { titulo: 'Título corrigido' } },
      })
    })

    it.each([
      [{ imagemCapaKey: null }, 'CAPA_OBRIGATORIA'],
      [{ conteudo: '' }, 'CONTEUDO_OBRIGATORIO'],
    ])('publicada com %j → 422 %s (critério 6)', async (dados, code) => {
      const key = capa()
      const criada = await noticia({ imagemCapaKey: key })
      const resposta = await (await como()).atualizar(criada.id, dados)
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe(code)
      expect(await noBanco(criada.id)).toMatchObject({
        imagemCapaKey: key,
        conteudo: criada.conteudo,
      })
    })

    it('outro Diretor mantém a capa sem revalidar a posse (critério 19)', async () => {
      const key = capa()
      const criada = await rascunhoCompleto({ imagemCapaKey: key })
      const outro = await usuario('DIRETOR')

      const resposta = await (
        await como(outro)
      ).atualizar(criada.id, {
        conteudo: 'Novo texto',
        imagemCapaKey: key,
      })

      expect(resposta.status).toBe(200)
      expect(consultasAoR2()).toEqual([])
      expect((await auditoria(criada.id))[0]?.dados).toEqual({
        antes: {},
        depois: { conteudoAlterado: true },
      })
    })

    it('trocar a capa valida a nova e remove a antiga do R2 depois do commit', async () => {
      const antiga = capa()
      const nova = capa()
      const criada = await rascunhoCompleto({ imagemCapaKey: antiga })

      const resposta = await (await como()).atualizar(criada.id, { imagemCapaKey: nova })

      expect(detalhe(resposta).imagemCapaUrl).toBe(`${BASE_PUBLICA}/${nova}`)
      expect(consultasAoR2().map(({ input }) => input.Key)).toEqual([nova])
      await aguardarOuvintes()
      const removidas = comandosEnviados(armazenamento.s3.send, DeleteObjectCommand)
      expect(removidas.map(({ input }) => input.Key)).toEqual([antiga])
      expect((await auditoria(criada.id))[0]?.dados).toEqual({
        antes: {},
        depois: { capaAlterada: true },
      })
    })

    it('capa de outra atlética → 422 UPLOAD_INVALIDO, nada muda', async () => {
      const key = capa()
      const criada = await rascunhoCompleto({ imagemCapaKey: key })
      const resposta = await (
        await como()
      ).atualizar(criada.id, {
        imagemCapaKey: chaveDeCapa((await criarAtletica()).id, diretor.id),
      })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('UPLOAD_INVALIDO')
      expect((await noBanco(criada.id)).imagemCapaKey).toBe(key)
    })

    it('sem mudança: 200 sem auditoria', async () => {
      const criada = await rascunhoCompleto()
      const resposta = await (await como()).atualizar(criada.id, { titulo: criada.titulo })
      expect(resposta.status).toBe(200)
      expect(await auditoria(criada.id)).toEqual([])
    })

    it.each([{}, { status: 'PUBLICADA' }, { titulo: 'x'.repeat(121) }])(
      'corpo %o → 400 VALIDATION_ERROR',
      async (corpo) => {
        const criada = await rascunhoCompleto()
        const resposta = await (await como()).atualizar(criada.id, corpo)
        expect(resposta.status).toBe(400)
        expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      },
    )
  })

  describe('DELETE /painel/noticias/:id', () => {
    it('Diretor → 403 e a notícia continua (critério 11)', async () => {
      const criada = await noticia()
      const resposta = await (await como()).excluir(criada.id)
      expect(resposta.status).toBe(403)
      expect(erro(resposta).code).toBe('FORBIDDEN')
      expect((await noBanco(criada.id)).excluidoEm).toBeNull()
    })

    it.each<Papel>(['PRESIDENTE', 'VICE_PRESIDENTE'])(
      '%s → 204, some do Painel e da leitura pública (critério 10)',
      async (papel) => {
        const criada = await noticia()
        const presidencia = await usuario(papel)
        const api = await como(presidencia)

        const resposta = await api.excluir(criada.id)

        expect(resposta.status).toBe(204)
        expect((await noBanco(criada.id)).excluidoEm).not.toBeNull()
        expect(listaNoticiasPainelSchema.parse((await api.listar()).body).total).toBe(0)
        expect((await api.publica(criada.id)).status).toBe(404)
        expect(await auditoria(criada.id)).toEqual([
          expect.objectContaining({
            acao: 'NOTICIA_EXCLUIDA',
            entidade: 'Noticia',
            usuarioId: presidencia.id,
            dados: { antes: { titulo: criada.titulo, status: 'PUBLICADA' }, depois: null },
          }),
        ])
      },
    )
  })
})
