import {
  presignRequestSchema,
  presignRespostaSchema,
  type PresignRequest,
  type PresignResposta,
} from '@atletica/shared'
import { Body, Controller, Header, Post } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator'
import type { UsuarioAutenticado } from '../auth/tipos'
import { EXPIRACAO_PRESIGN_SEGUNDOS, LIMITE_PRESIGN, UploadsService } from './uploads.service'

class PresignRequestDto extends createZodDto(presignRequestSchema) {}
class PresignRespostaDto extends createZodDto(presignRespostaSchema) {}

const EXEMPLO_PEDIDO: PresignRequest = {
  finalidade: 'NOTICIA',
  contentType: 'image/jpeg',
  tamanhoBytes: 734512,
}

const KEY_EXEMPLO =
  'atleticas/6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11/noticias/0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90/' +
  '3e7d9c1b-5a4f-4e2d-8b6a-9c0d1e2f3a4b.jpg'

const EXEMPLO_RESPOSTA: PresignResposta = {
  uploadUrl:
    `https://<account>.r2.cloudflarestorage.com/atletica-imagens-prod/${KEY_EXEMPLO}` +
    `?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${EXPIRACAO_PRESIGN_SEGUNDOS}&...`,
  key: KEY_EXEMPLO,
  publicUrl: `https://img.exemplo.com/${KEY_EXEMPLO}`,
  expiresAt: '2026-10-01T22:05:00.000Z',
}

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** Qualquer autenticado; `NOTICIA`/`BANNER` exigem DIRETOR (depende do corpo, conferido no service). */
  @Post('presign')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'URL PUT pré-assinada do R2 para enviar uma imagem',
    description:
      `A URL vale ${EXPIRACAO_PRESIGN_SEGUNDOS / 60} min. Envie o \`PUT\` direto ao R2, sem ` +
      '`Authorization`, com `Content-Type` = `contentType` e `Content-Length` = `tamanhoBytes` ' +
      '(ambos assinados). Depois envie a `key` ao recurso (ex.: `fotoKey`).\n\n' +
      '| HTTP | code | Quando |\n|---|---|---|\n' +
      '| 400 | `VALIDATION_ERROR` | finalidade, tipo ou tamanho inválidos; campo desconhecido |\n' +
      '| 401 | `UNAUTHENTICATED` / `TOKEN_EXPIRED` | sem token / expirado |\n' +
      '| 403 | `FORBIDDEN` | ATLETA pedindo `NOTICIA` ou `BANNER` |\n' +
      `| 429 | \`RATE_LIMITED\` | mais de ${LIMITE_PRESIGN.maximo} pedidos por hora |\n` +
      '| 503 | `ARMAZENAMENTO_INDISPONIVEL` | falha ao assinar (credenciais/R2) |',
  })
  @ApiBody({ type: PresignRequestDto, examples: { noticia: { value: EXEMPLO_PEDIDO } } })
  @ApiCreatedResponse({ type: PresignRespostaDto, example: EXEMPLO_RESPOSTA })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR` (inclui campo desconhecido).' })
  @ApiForbiddenResponse({ description: '`FORBIDDEN`: `NOTICIA` e `BANNER` exigem DIRETOR.' })
  @ApiTooManyRequestsResponse({
    description: `\`RATE_LIMITED\`: mais de ${LIMITE_PRESIGN.maximo} pedidos por hora.`,
    headers: { 'Retry-After': { description: 'Segundos até a próxima tentativa.' } },
  })
  @ApiServiceUnavailableResponse({ description: '`ARMAZENAMENTO_INDISPONIVEL`.' })
  presign(
    @Body() dados: PresignRequestDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<PresignResposta> {
    return this.uploads.presign(dados, usuario)
  }
}
