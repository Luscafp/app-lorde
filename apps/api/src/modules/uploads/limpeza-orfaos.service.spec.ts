import {
  DeleteObjectsCommand,
  type DeleteObjectsCommandOutput,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  type S3Client,
} from '@aws-sdk/client-s3'
import { Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import type { PrismaService } from '../../infra/prisma/prisma.service'
import { gerarChave } from './chaves'
import { IDADE_MINIMA_ORFAO_MS, LimpezaOrfaosService } from './limpeza-orfaos.service'

const dono = {
  usuarioId: '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90',
  atleticaId: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
}
const AGORA = new Date('2026-10-04T06:30:00.000Z')
const VELHO = new Date(AGORA.getTime() - IDADE_MINIMA_ORFAO_MS - 1)
const RECENTE = new Date(AGORA.getTime() - IDADE_MINIMA_ORFAO_MS + 1000)

const perfil = () => gerarChave('PERFIL', 'image/jpeg', dono)
const noticia = () => gerarChave('NOTICIA', 'image/png', dono)
const banner = () => gerarChave('BANNER', 'image/webp', dono)
const objeto = (Key: string, LastModified = VELHO) => ({ Key, LastModified })

describe('LimpezaOrfaosService', () => {
  let paginas: Partial<ListObjectsV2CommandOutput>[]
  let apagar: jest.Mock<Promise<Partial<DeleteObjectsCommandOutput>>, [DeleteObjectsCommand]>
  let s3: { send: jest.Mock }
  let referencias: { fotoKey: string[]; imagemCapaKey: string[]; imagemKey: string[] }
  let servico: LimpezaOrfaosService

  beforeEach(() => {
    paginas = []
    apagar = jest.fn((_comando: DeleteObjectsCommand) =>
      Promise.resolve<Partial<DeleteObjectsCommandOutput>>({}),
    )
    s3 = {
      send: jest.fn((comando: unknown) => {
        if (comando instanceof ListObjectsV2Command) return Promise.resolve(paginas.shift())
        if (comando instanceof DeleteObjectsCommand) return apagar(comando)
        throw new Error('comando inesperado')
      }),
    }
    referencias = { fotoKey: [], imagemCapaKey: [], imagemKey: [] }
    const modelo = (coluna: keyof typeof referencias) => ({
      findMany: ({ where }: { where: Record<string, { in: string[] }> }) =>
        Promise.resolve(
          referencias[coluna]
            .filter((key) => where[coluna]?.in.includes(key))
            .map((key) => ({ [coluna]: key })),
        ),
    })
    const prisma = {
      semEscopo: {
        usuario: modelo('fotoKey'),
        noticia: modelo('imagemCapaKey'),
        banner: modelo('imagemKey'),
      },
    }
    const config = { get: () => 'imagens' }
    servico = new LimpezaOrfaosService(
      s3 as unknown as S3Client,
      prisma as unknown as PrismaService,
      config as unknown as ConfigService<Env, true>,
    )
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const apagadas = () =>
    apagar.mock.calls.flatMap(([comando]) =>
      (comando.input.Delete?.Objects ?? []).map(({ Key }) => Key),
    )

  it('remove só os não referenciados com mais de 24 h e mantém referenciados e recentes', async () => {
    const [orfaPerfil, orfaNoticia, orfaBanner] = [perfil(), noticia(), banner()]
    const [foto, capa, imagem] = [perfil(), noticia(), banner()]
    const [recente, limite] = [perfil(), perfil()]
    referencias = { fotoKey: [foto], imagemCapaKey: [capa], imagemKey: [imagem] }
    paginas = [
      {
        Contents: [
          objeto(orfaPerfil),
          objeto(orfaNoticia),
          objeto(orfaBanner),
          objeto(foto),
          objeto(capa),
          objeto(imagem),
          objeto(recente, RECENTE),
          objeto(limite, new Date(AGORA.getTime() - IDADE_MINIMA_ORFAO_MS)),
        ],
      },
    ]

    const resultado = await servico.executar(AGORA)

    expect(apagadas()).toEqual([orfaPerfil, orfaNoticia, orfaBanner])
    expect(apagar.mock.calls[0]?.[0].input).toMatchObject({
      Bucket: 'imagens',
      Delete: { Quiet: true },
    })
    expect(resultado).toEqual({ listados: 8, referenciados: 3, removidos: 3, falhas: 0 })
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      { job: 'uploads.limpeza-orfaos', ...resultado },
      'Limpeza de órfãos concluída',
    )
  })

  it.each([
    ['prefixo desconhecido', 'backups/2026-10-01.sql'],
    ['finalidade com segmento a mais', `usuarios/${dono.usuarioId}/perfil/x/f.jpg`],
    ['nome que não é UUID', `usuarios/${dono.usuarioId}/perfil/foto.jpg`],
    ['extensão não permitida', perfil().replace(/\.jpg$/, '.html')],
  ])('mantém chave fora dos formatos conhecidos (%s)', async (_caso, key) => {
    paginas = [{ Contents: [objeto(key)] }]

    const resultado = await servico.executar(AGORA)

    expect(apagar).not.toHaveBeenCalled()
    expect(resultado).toEqual({ listados: 1, referenciados: 0, removidos: 0, falhas: 0 })
  })

  it('percorre todas as páginas da listagem', async () => {
    const [primeira, segunda] = [perfil(), noticia()]
    paginas = [
      { Contents: [objeto(primeira)], IsTruncated: true, NextContinuationToken: 'p2' },
      { Contents: [objeto(segunda)], IsTruncated: false },
    ]

    const resultado = await servico.executar(AGORA)

    const listagens = s3.send.mock.calls
      .map(([comando]: [unknown]) => comando)
      .filter((comando): comando is ListObjectsV2Command => comando instanceof ListObjectsV2Command)
    expect(listagens.map(({ input }) => input)).toEqual([
      { Bucket: 'imagens', ContinuationToken: undefined },
      { Bucket: 'imagens', ContinuationToken: 'p2' },
    ])
    expect(apagadas()).toEqual([primeira, segunda])
    expect(resultado).toMatchObject({ listados: 2, removidos: 2 })
  })

  it('falha num objeto não impede os demais e entra no total de falhas', async () => {
    const [falha, ok] = [perfil(), perfil()]
    paginas = [{ Contents: [objeto(falha), objeto(ok)] }]
    apagar.mockResolvedValueOnce({ Errors: [{ Key: falha, Code: 'AccessDenied' }] })

    const resultado = await servico.executar(AGORA)

    expect(resultado).toEqual({ listados: 2, referenciados: 0, removidos: 1, falhas: 1 })
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      { job: 'uploads.limpeza-orfaos', key: falha, code: 'AccessDenied' },
      'Falha ao remover órfão do R2',
    )
  })

  it('falha no lote conta todas as chaves dele e segue para a próxima página', async () => {
    const [a, b, c] = [perfil(), perfil(), perfil()]
    paginas = [
      { Contents: [objeto(a), objeto(b)], IsTruncated: true, NextContinuationToken: 'p2' },
      { Contents: [objeto(c)] },
    ]
    apagar.mockRejectedValueOnce(new Error('R2 fora do ar'))

    const resultado = await servico.executar(AGORA)

    expect(apagadas()).toEqual([a, b, c])
    expect(resultado).toEqual({ listados: 3, referenciados: 0, removidos: 1, falhas: 2 })
  })

  it('bucket vazio não chama o DeleteObjects', async () => {
    paginas = [{ KeyCount: 0 }]

    await expect(servico.executar(AGORA)).resolves.toEqual({
      listados: 0,
      referenciados: 0,
      removidos: 0,
      falhas: 0,
    })
    expect(apagar).not.toHaveBeenCalled()
  })

  it('falha na listagem é propagada sem apagar nada', async () => {
    s3.send.mockRejectedValueOnce(new Error('credenciais inválidas'))

    await expect(servico.executar(AGORA)).rejects.toThrow('credenciais inválidas')
    expect(apagar).not.toHaveBeenCalled()
  })
})
