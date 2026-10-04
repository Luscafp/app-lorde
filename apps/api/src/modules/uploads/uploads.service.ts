import {
  DeleteObjectCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import {
  FinalidadeUpload,
  Papel,
  TAMANHO_MAXIMO_IMAGEM,
  temNivelMinimo,
  TIPOS_IMAGEM,
  type PresignRequest,
  type PresignResposta,
} from '@atletica/shared'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.schema'
import { erroSemPermissao } from '../auth/erros'
import { RateLimitService, TipoTentativa, type LimiteTentativas } from '../auth/rate-limit.service'
import type { UsuarioAutenticado } from '../auth/tipos'
import { ASSINAR_URL, type AssinarUrl } from './armazenamento'
import { gerarChave, lerChave } from './chaves'
import { erroArmazenamentoIndisponivel, erroUploadInvalido, erroUploadNaoEncontrado } from './erros'

export const EXPIRACAO_PRESIGN_SEGUNDOS = 300
export const LIMITE_PRESIGN: LimiteTentativas = { maximo: 30, janelaMs: 60 * 60 * 1000 }

/** Cabeçalhos assinados: o R2 recusa o `PUT` com tipo ou tamanho diferente do declarado. */
const CABECALHOS_ASSINADOS = new Set(['content-type', 'content-length'])

export interface ValidacaoKey {
  key: string
  finalidade: FinalidadeUpload
  /** Usuário atual (do token), nunca o do corpo. */
  usuarioId: string
  /** Atlética do token; conferida em `NOTICIA` e `BANNER`. */
  atleticaId: string
}

/** Presign e imagens no R2; uso pelos consumidores no README da API. */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name)
  private readonly bucket: string
  private readonly basePublica: string

  constructor(
    private readonly s3: S3Client,
    @Inject(ASSINAR_URL) private readonly assinar: AssinarUrl,
    private readonly rateLimit: RateLimitService,
    config: ConfigService<Env, true>,
  ) {
    this.bucket = config.get('R2_BUCKET_IMAGENS', { infer: true })
    this.basePublica = config.get('R2_PUBLIC_BASE_URL', { infer: true })
  }

  async presign(
    { finalidade, contentType, tamanhoBytes }: PresignRequest,
    usuario: Pick<UsuarioAutenticado, 'id' | 'atleticaId' | 'papel'>,
    agora: Date = new Date(),
  ): Promise<PresignResposta> {
    if (finalidade !== FinalidadeUpload.PERFIL && !temNivelMinimo(usuario.papel, Papel.DIRETOR)) {
      throw erroSemPermissao()
    }
    await this.rateLimit.verificar(TipoTentativa.PRESIGN, usuario.id, LIMITE_PRESIGN, agora)

    const key = gerarChave(finalidade, contentType, {
      usuarioId: usuario.id,
      atleticaId: usuario.atleticaId,
    })
    const comando = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: tamanhoBytes,
    })
    let uploadUrl: string
    try {
      uploadUrl = await this.assinar(this.s3, comando, {
        expiresIn: EXPIRACAO_PRESIGN_SEGUNDOS,
        signableHeaders: CABECALHOS_ASSINADOS,
      })
    } catch (erro) {
      throw erroArmazenamentoIndisponivel(erro)
    }
    await this.rateLimit.registrar(TipoTentativa.PRESIGN, usuario.id, agora)

    return {
      uploadUrl,
      key,
      publicUrl: this.urlPublica(key),
      expiresAt: new Date(agora.getTime() + EXPIRACAO_PRESIGN_SEGUNDOS * 1000).toISOString(),
    }
  }

  /** Formato, posse, atlética e objeto no R2; chame só quando a `key` mudar. */
  async validarKey({ key, finalidade, usuarioId, atleticaId }: ValidacaoKey): Promise<void> {
    const dono = lerChave(key, finalidade)
    const daAtletica = finalidade === FinalidadeUpload.PERFIL || dono?.atleticaId === atleticaId
    if (dono?.usuarioId !== usuarioId || !daAtletica) throw erroUploadInvalido()

    const objeto = await this.consultar(key)
    if (!objeto) throw erroUploadNaoEncontrado()
    const tamanho = objeto.ContentLength ?? Infinity
    const tipo = objeto.ContentType ?? ''
    if (tamanho > TAMANHO_MAXIMO_IMAGEM || !(TIPOS_IMAGEM as string[]).includes(tipo)) {
      throw erroUploadInvalido()
    }
  }

  urlPublica(key: string): string
  urlPublica(key: string | null): string | null
  urlPublica(key: string | null): string | null {
    return key === null ? null : `${this.basePublica}/${key}`
  }

  /** Melhor esforço: a falha só gera `warn` e o objeto é recolhido pela limpeza de órfãos (#56). */
  async remover(key: string): Promise<void> {
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch (erro) {
      this.logger.warn({ err: erro, key }, 'Falha ao remover imagem do R2')
    }
  }

  private async consultar(key: string): Promise<HeadObjectCommandOutput | null> {
    try {
      return await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch (erro) {
      if (erro instanceof S3ServiceException && erro.$metadata.httpStatusCode === 404) return null
      throw erroArmazenamentoIndisponivel(erro)
    }
  }
}
