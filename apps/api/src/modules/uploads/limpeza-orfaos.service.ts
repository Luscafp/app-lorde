import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import { PrismaService } from '../../infra/prisma/prisma.service'
import { ehChaveDeUpload } from './chaves'

export const JOB_LIMPEZA_ORFAOS = 'uploads.limpeza-orfaos'
/** Margem para o upload recém-feito que ainda não foi gravado na entidade. */
export const IDADE_MINIMA_ORFAO_MS = 24 * 60 * 60 * 1000

export interface ResultadoLimpezaOrfaos {
  listados: number
  referenciados: number
  removidos: number
  falhas: number
}

/** Apaga do bucket as imagens que nenhum registro referencia (épico #9 §14 (a)). */
@Injectable()
export class LimpezaOrfaosService {
  private readonly logger = new Logger(LimpezaOrfaosService.name)
  private readonly bucket: string

  constructor(
    private readonly s3: S3Client,
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.bucket = config.get('R2_BUCKET_IMAGENS', { infer: true })
  }

  async executar(agora: Date = new Date()): Promise<ResultadoLimpezaOrfaos> {
    const limite = agora.getTime() - IDADE_MINIMA_ORFAO_MS
    const resultado: ResultadoLimpezaOrfaos = {
      listados: 0,
      referenciados: 0,
      removidos: 0,
      falhas: 0,
    }
    let continuacao: string | undefined
    do {
      const pagina = await this.s3.send(
        new ListObjectsV2Command({ Bucket: this.bucket, ContinuationToken: continuacao }),
      )
      const objetos = pagina.Contents ?? []
      const candidatas = objetos.flatMap(({ Key, LastModified }) =>
        Key && LastModified && LastModified.getTime() < limite && ehChaveDeUpload(Key) ? [Key] : [],
      )
      const referenciadas = await this.referenciadas(candidatas)
      const orfas = candidatas.filter((key) => !referenciadas.has(key))

      resultado.listados += objetos.length
      resultado.referenciados += referenciadas.size
      // Uma página do ListObjectsV2 tem no máximo 1000 chaves, o limite do DeleteObjects.
      const { removidos, falhas } = await this.apagar(orfas)
      resultado.removidos += removidos
      resultado.falhas += falhas
      continuacao = pagina.IsTruncated ? pagina.NextContinuationToken : undefined
    } while (continuacao)

    this.logger.log({ job: JOB_LIMPEZA_ORFAOS, ...resultado }, 'Limpeza de órfãos concluída')
    return resultado
  }

  /** Inclui registros excluídos logicamente: `semEscopo` não filtra `excluidoEm`. */
  private async referenciadas(keys: string[]): Promise<Set<string>> {
    if (keys.length === 0) return new Set()
    const db = this.prisma.semEscopo
    const [usuarios, noticias, banners] = await Promise.all([
      db.usuario.findMany({ where: { fotoKey: { in: keys } }, select: { fotoKey: true } }),
      db.noticia.findMany({
        where: { imagemCapaKey: { in: keys } },
        select: { imagemCapaKey: true },
      }),
      db.banner.findMany({ where: { imagemKey: { in: keys } }, select: { imagemKey: true } }),
    ])
    return new Set(
      [
        ...usuarios.map(({ fotoKey }) => fotoKey),
        ...noticias.map(({ imagemCapaKey }) => imagemCapaKey),
        ...banners.map(({ imagemKey }) => imagemKey),
      ].filter((key): key is string => key !== null),
    )
  }

  private async apagar(
    keys: string[],
  ): Promise<Pick<ResultadoLimpezaOrfaos, 'removidos' | 'falhas'>> {
    if (keys.length === 0) return { removidos: 0, falhas: 0 }
    try {
      const { Errors: erros = [] } = await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      )
      for (const { Key: key, Code: code } of erros) {
        this.logger.warn({ job: JOB_LIMPEZA_ORFAOS, key, code }, 'Falha ao remover órfão do R2')
      }
      return { removidos: keys.length - erros.length, falhas: erros.length }
    } catch (erro) {
      this.logger.warn(
        { err: erro, job: JOB_LIMPEZA_ORFAOS, quantidade: keys.length },
        'Falha ao remover lote de órfãos do R2',
      )
      return { removidos: 0, falhas: keys.length }
    }
  }
}
