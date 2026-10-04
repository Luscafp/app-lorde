import { PutObjectCommand } from '@aws-sdk/client-s3'
import { presignRespostaSchema, type Papel } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { tokenPara } from '../fabricas/auth'
import {
  simularArmazenamento,
  URL_ASSINADA_FICTICIA,
  type ArmazenamentoSimulado,
} from '../fabricas/uploads'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/uploads/presign'
const BASE_PUBLICA = 'https://imagens.teste.local'
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro
const PERFIL = { finalidade: 'PERFIL', contentType: 'image/jpeg', tamanhoBytes: 800_000 }

describe('POST /uploads/presign (#54)', () => {
  let contexto: AppDeTeste
  let armazenamento: ArmazenamentoSimulado

  beforeAll(async () => {
    armazenamento = simularArmazenamento()
    contexto = await criarApp({ ajustar: armazenamento.ajustar })
  })

  beforeEach(() => {
    armazenamento.assinar.mockClear()
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  async function pedir(usuario: UsuarioCriado, corpo: object = PERFIL) {
    return request(contexto.http)
      .post(ROTA)
      .set('Authorization', `Bearer ${await tokenPara(usuario)}`)
      .send(corpo)
  }

  const tentativas = () => prismaTeste.tentativaAcesso.count({ where: { tipo: 'PRESIGN' } })

  it('sem token → 401', async () => {
    const resposta = await request(contexto.http).post(ROTA).send(PERFIL)
    expect(resposta.status).toBe(401)
    expect(erro(resposta).code).toBe('UNAUTHENTICATED')
  })

  it('ATLETA com PERFIL → 201 com a chave dele, URL pública e expiração em 5 min (critério 1)', async () => {
    const atleta = await criarUsuario()
    const antes = Date.now()
    const resposta = await pedir(atleta)

    expect(resposta.status).toBe(201)
    expect(resposta.headers['cache-control']).toBe('no-store')
    const corpo = presignRespostaSchema.parse(resposta.body)
    expect(corpo.uploadUrl).toBe(URL_ASSINADA_FICTICIA)
    expect(corpo.key).toMatch(new RegExp(`^usuarios/${atleta.id}/perfil/${UUID}\\.jpg$`))
    expect(corpo.publicUrl).toBe(`${BASE_PUBLICA}/${corpo.key}`)
    const expiraEm = new Date(corpo.expiresAt).getTime()
    expect(expiraEm).toBeGreaterThanOrEqual(antes + 300_000)
    expect(expiraEm).toBeLessThanOrEqual(Date.now() + 300_000)

    const [, comando, opcoes] = armazenamento.assinar.mock.calls[0] ?? []
    expect((comando as PutObjectCommand).input).toEqual({
      Bucket: 'atletica-imagens-test',
      Key: corpo.key,
      ContentType: 'image/jpeg',
      ContentLength: 800_000,
    })
    expect(opcoes).toEqual({
      expiresIn: 300,
      signableHeaders: new Set(['content-type', 'content-length']),
    })
    await expect(
      prismaTeste.tentativaAcesso.findMany({ select: { tipo: true, chave: true } }),
    ).resolves.toEqual([{ tipo: 'PRESIGN', chave: atleta.id }])
  })

  describe('papéis (critério 2)', () => {
    it.each(['NOTICIA', 'BANNER'])(
      'ATLETA com %s → 403 sem consumir o limite',
      async (finalidade) => {
        const resposta = await pedir(await criarUsuario(), { ...PERFIL, finalidade })
        expect(resposta.status).toBe(403)
        expect(erro(resposta).code).toBe('FORBIDDEN')
        expect(armazenamento.assinar).not.toHaveBeenCalled()
        await expect(tentativas()).resolves.toBe(0)
      },
    )

    it.each([
      ['DIRETOR', 'NOTICIA', 'noticias'],
      ['DIRETOR', 'BANNER', 'banners'],
      ['PRESIDENTE', 'NOTICIA', 'noticias'],
    ] as [Papel, string, string][])(
      '%s com %s → 201 na pasta da atlética',
      async (papel, finalidade, pasta) => {
        const usuario = await criarUsuario({ papel })
        const resposta = await pedir(usuario, { ...PERFIL, finalidade, contentType: 'image/webp' })
        expect(resposta.status).toBe(201)
        expect(presignRespostaSchema.parse(resposta.body).key).toMatch(
          new RegExp(`^atleticas/${usuario.atleticaId}/${pasta}/${usuario.id}/${UUID}\\.webp$`),
        )
      },
    )
  })

  describe('validação', () => {
    it.each(['image/gif', 'application/pdf'])(
      'contentType %s → 400 (critério 3)',
      async (contentType) => {
        const resposta = await pedir(await criarUsuario(), { ...PERFIL, contentType })
        expect(resposta.status).toBe(400)
        expect(erro(resposta).code).toBe('VALIDATION_ERROR')
        expect(erro(resposta).details[0]?.field).toBe('contentType')
      },
    )

    it('mais de 5 MB → 400 com a mensagem do RNF04 (critério 4)', async () => {
      const resposta = await pedir(await criarUsuario(), { ...PERFIL, tamanhoBytes: 5_242_881 })
      expect(resposta.status).toBe(400)
      expect(erro(resposta).details).toEqual([
        { field: 'tamanhoBytes', message: 'A imagem deve ter no máximo 5 MB.' },
      ])
    })

    it('campo extra → 400 (.strict())', async () => {
      const resposta = await pedir(await criarUsuario(), {
        ...PERFIL,
        key: 'usuarios/x/perfil/y.jpg',
      })
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      expect(armazenamento.assinar).not.toHaveBeenCalled()
    })
  })

  it('31º pedido na hora → 429 com Retry-After (critério 16)', async () => {
    const atleta = await criarUsuario()
    const token = await tokenPara(atleta)
    for (let i = 0; i < 30; i++) {
      const resposta = await request(contexto.http)
        .post(ROTA)
        .set('Authorization', `Bearer ${token}`)
        .send(PERFIL)
      expect(resposta.status).toBe(201)
    }

    const bloqueado = await request(contexto.http)
      .post(ROTA)
      .set('Authorization', `Bearer ${token}`)
      .send(PERFIL)
    expect(bloqueado.status).toBe(429)
    expect(erro(bloqueado).code).toBe('RATE_LIMITED')
    const retryAfter = Number(bloqueado.headers['retry-after'])
    expect(retryAfter).toBeGreaterThan(3500)
    expect(retryAfter).toBeLessThanOrEqual(3600)
    await expect(tentativas()).resolves.toBe(30)

    const outro = await pedir(await criarUsuario())
    expect(outro.status).toBe(201)
  })

  it('falha ao assinar → 503 sem registrar TentativaAcesso', async () => {
    armazenamento.assinar.mockRejectedValueOnce(new Error('credenciais inválidas'))
    const resposta = await pedir(await criarUsuario())
    expect(resposta.status).toBe(503)
    expect(resposta.body).toEqual({
      statusCode: 503,
      code: 'ARMAZENAMENTO_INDISPONIVEL',
      message: 'Não foi possível acessar o armazenamento de imagens. Tente novamente.',
      details: [],
    })
    await expect(tentativas()).resolves.toBe(0)
  })
})
