import {
  DeleteObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3'
import type { Papel } from '@atletica/shared'
import { Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { ErroLimiteExcedido } from '../../common/erros/erro-negocio'
import type { Env } from '../../config/env.schema'
import type { RateLimitService } from '../auth/rate-limit.service'
import type { AssinarUrl } from './armazenamento'
import { gerarChave } from './chaves'
import { LIMITE_PRESIGN, UploadsService } from './uploads.service'

const usuarioId = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const atleticaId = '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11'
const outroId = '9a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d'
const BASE = 'https://img.ex.com'
const agora = new Date('2026-10-04T12:00:00.000Z')

const objeto = (ContentLength: number, ContentType: string) => ({ ContentLength, ContentType })

describe('UploadsService', () => {
  let s3: { send: jest.Mock }
  let assinar: jest.Mock<ReturnType<AssinarUrl>, Parameters<AssinarUrl>>
  let rateLimit: { verificar: jest.Mock; registrar: jest.Mock }
  let servico: UploadsService

  beforeEach(() => {
    s3 = { send: jest.fn().mockResolvedValue(objeto(800_000, 'image/jpeg')) }
    assinar = jest.fn<ReturnType<AssinarUrl>, Parameters<AssinarUrl>>()
    assinar.mockResolvedValue('https://r2.exemplo/assinada')
    rateLimit = { verificar: jest.fn().mockResolvedValue(30), registrar: jest.fn() }
    const env: Partial<Env> = { R2_BUCKET_IMAGENS: 'imagens', R2_PUBLIC_BASE_URL: BASE }
    const config = { get: (chave: keyof Env) => env[chave] }
    servico = new UploadsService(
      s3 as unknown as S3Client,
      assinar,
      rateLimit as unknown as RateLimitService,
      config as unknown as ConfigService<Env, true>,
    )
  })

  describe('presign', () => {
    const usuario = (papel: Papel) => ({ id: usuarioId, atleticaId, papel })
    const pedido = {
      finalidade: 'PERFIL',
      contentType: 'image/jpeg',
      tamanhoBytes: 800_000,
    } as const

    it('assina PUT com content-type e content-length por 300 s', async () => {
      const resposta = await servico.presign(pedido, usuario('ATLETA'), agora)

      const [cliente, comando, opcoes] = assinar.mock.calls[0] ?? []
      expect(cliente).toBe(s3)
      expect(comando).toBeInstanceOf(PutObjectCommand)
      expect((comando as PutObjectCommand).input).toEqual({
        Bucket: 'imagens',
        Key: resposta.key,
        ContentType: 'image/jpeg',
        ContentLength: 800_000,
      })
      expect(opcoes).toEqual({
        expiresIn: 300,
        signableHeaders: new Set(['content-type', 'content-length']),
      })
      expect(resposta.key).toMatch(new RegExp(`^usuarios/${usuarioId}/perfil/[0-9a-f-]{36}\\.jpg$`))
      expect(resposta).toEqual({
        uploadUrl: 'https://r2.exemplo/assinada',
        key: resposta.key,
        publicUrl: `${BASE}/${resposta.key}`,
        expiresAt: '2026-10-04T12:05:00.000Z',
      })
    })

    it('verifica o limite antes de assinar e registra depois', async () => {
      await servico.presign(pedido, usuario('ATLETA'), agora)
      expect(rateLimit.verificar).toHaveBeenCalledWith('PRESIGN', usuarioId, LIMITE_PRESIGN, agora)
      expect(rateLimit.registrar).toHaveBeenCalledWith('PRESIGN', usuarioId, agora)
      const ordem = (mock: jest.Mock) => mock.mock.invocationCallOrder[0]
      expect(ordem(rateLimit.verificar)).toBeLessThan(ordem(assinar) ?? 0)
      expect(ordem(assinar)).toBeLessThan(ordem(rateLimit.registrar) ?? 0)
    })

    it('limite excedido → 429 sem assinar', async () => {
      rateLimit.verificar.mockRejectedValue(new ErroLimiteExcedido(60))
      await expect(servico.presign(pedido, usuario('ATLETA'), agora)).rejects.toMatchObject({
        code: 'RATE_LIMITED',
      })
      expect(assinar).not.toHaveBeenCalled()
    })

    it.each(['NOTICIA', 'BANNER'] as const)(
      'ATLETA com %s → 403 sem consumir o limite',
      async (f) => {
        await expect(
          servico.presign({ ...pedido, finalidade: f }, usuario('ATLETA'), agora),
        ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' })
        expect(rateLimit.verificar).not.toHaveBeenCalled()
      },
    )

    it.each(['DIRETOR', 'VICE_PRESIDENTE', 'ADMINISTRADOR'] as const)(
      '%s pede NOTICIA na pasta da atlética',
      async (papel) => {
        const { key } = await servico.presign({ ...pedido, finalidade: 'NOTICIA' }, usuario(papel))
        expect(key).toMatch(new RegExp(`^atleticas/${atleticaId}/noticias/${usuarioId}/`))
      },
    )

    it('falha ao assinar → 503 sem registrar a tentativa', async () => {
      const causa = new Error('credenciais inválidas')
      assinar.mockRejectedValue(causa)
      await expect(servico.presign(pedido, usuario('ATLETA'), agora)).rejects.toMatchObject({
        statusCode: 503,
        code: 'ARMAZENAMENTO_INDISPONIVEL',
        cause: causa,
      })
      expect(rateLimit.registrar).not.toHaveBeenCalled()
    })
  })

  describe('validarKey', () => {
    const dono = { usuarioId, atleticaId }
    const perfil = gerarChave('PERFIL', 'image/jpeg', dono)
    const noticia = gerarChave('NOTICIA', 'image/png', dono)
    const banner = gerarChave('BANNER', 'image/webp', dono)

    it.each([
      ['PERFIL', perfil],
      ['NOTICIA', noticia],
      ['BANNER', banner],
    ] as const)('aceita %s do próprio usuário e da atlética', async (finalidade, key) => {
      await expect(servico.validarKey({ key, finalidade, ...dono })).resolves.toBeUndefined()
      const [comando] = s3.send.mock.calls[0] as [HeadObjectCommand]
      expect(comando).toBeInstanceOf(HeadObjectCommand)
      expect(comando.input).toEqual({ Bucket: 'imagens', Key: key })
    })

    it('PERFIL não depende da atlética do token', async () => {
      await expect(
        servico.validarKey({ key: perfil, finalidade: 'PERFIL', usuarioId, atleticaId: outroId }),
      ).resolves.toBeUndefined()
    })

    it.each([
      ['de outro usuário', { key: perfil, finalidade: 'PERFIL', usuarioId: outroId, atleticaId }],
      [
        'de outra atlética',
        { key: noticia, finalidade: 'NOTICIA', usuarioId, atleticaId: outroId },
      ],
      [
        'de outra atlética (banner)',
        { key: banner, finalidade: 'BANNER', usuarioId, atleticaId: outroId },
      ],
      ['PERFIL usada como capa', { key: perfil, finalidade: 'NOTICIA', ...dono }],
      ['NOTICIA usada como banner', { key: noticia, finalidade: 'BANNER', ...dono }],
      ['com ..', { key: `usuarios/${usuarioId}/perfil/../x.jpg`, finalidade: 'PERFIL', ...dono }],
      [
        'com barra extra',
        { key: perfil.replace('/perfil/', '//perfil/'), finalidade: 'PERFIL', ...dono },
      ],
    ] as const)('chave %s → 422 UPLOAD_INVALIDO sem consultar o R2', async (_caso, entrada) => {
      await expect(servico.validarKey(entrada)).rejects.toMatchObject({
        statusCode: 422,
        code: 'UPLOAD_INVALIDO',
      })
      expect(s3.send).not.toHaveBeenCalled()
    })

    it('objeto inexistente → 422 UPLOAD_NAO_ENCONTRADO', async () => {
      s3.send.mockRejectedValue(
        new NotFound({ message: 'NotFound', $metadata: { httpStatusCode: 404 } }),
      )
      await expect(
        servico.validarKey({ key: perfil, finalidade: 'PERFIL', ...dono }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'UPLOAD_NAO_ENCONTRADO',
      })
    })

    it.each([
      ['maior que 5 MB', objeto(5_242_881, 'image/jpeg')],
      ['text/html', objeto(1_000, 'text/html')],
      ['sem tipo nem tamanho', {}],
    ])('objeto %s → 422 UPLOAD_INVALIDO', async (_caso, cabecalhos) => {
      s3.send.mockResolvedValue(cabecalhos)
      await expect(
        servico.validarKey({ key: perfil, finalidade: 'PERFIL', ...dono }),
      ).rejects.toMatchObject({
        code: 'UPLOAD_INVALIDO',
      })
    })

    it('aceita exatamente 5 MB', async () => {
      s3.send.mockResolvedValue(objeto(5_242_880, 'image/webp'))
      await expect(
        servico.validarKey({ key: perfil, finalidade: 'PERFIL', ...dono }),
      ).resolves.toBeUndefined()
    })

    it('R2 indisponível → 503', async () => {
      s3.send.mockRejectedValue(new Error('ECONNRESET'))
      await expect(
        servico.validarKey({ key: perfil, finalidade: 'PERFIL', ...dono }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'ARMAZENAMENTO_INDISPONIVEL',
      })
    })
  })

  describe('urlPublica', () => {
    it('monta base/key e devolve null sem chave', () => {
      expect(servico.urlPublica('usuarios/u/perfil/f.jpg')).toBe(`${BASE}/usuarios/u/perfil/f.jpg`)
      expect(servico.urlPublica(null)).toBeNull()
    })
  })

  describe('remover', () => {
    it('apaga o objeto', async () => {
      await servico.remover('usuarios/u/perfil/f.jpg')
      const [comando] = s3.send.mock.calls[0] as [DeleteObjectCommand]
      expect(comando).toBeInstanceOf(DeleteObjectCommand)
      expect(comando.input).toEqual({ Bucket: 'imagens', Key: 'usuarios/u/perfil/f.jpg' })
    })

    it('falha só gera warn', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
      const erro = new Error('R2 fora do ar')
      s3.send.mockRejectedValue(erro)

      await expect(servico.remover('usuarios/u/perfil/f.jpg')).resolves.toBeUndefined()
      expect(warn).toHaveBeenCalledWith(
        { err: erro, key: 'usuarios/u/perfil/f.jpg' },
        'Falha ao remover imagem do R2',
      )
      warn.mockRestore()
    })
  })
})
