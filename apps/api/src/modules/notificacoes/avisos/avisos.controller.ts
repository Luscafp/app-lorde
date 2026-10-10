import {
  alcanceAvisoQuerySchema,
  alcanceAvisoSchema,
  avisoEnviadoSchema,
  enviarAvisoSchema,
  Papel,
  type AlcanceAviso,
  type AvisoEnviado,
  type EnviarAviso,
} from '@atletica/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Query } from '@nestjs/common'
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { PapelMinimo } from '../../auth/decorators/papel-minimo.decorator'
import { UsuarioAtual } from '../../auth/decorators/usuario-atual.decorator'
import type { UsuarioAutenticado } from '../../auth/tipos'
import { AvisosService } from './avisos.service'

/** União não é tipável como classe; o pipe valida pelo schema e devolve o tipo do shared. */
const EnviarAvisoDtoBase: new () => object = createZodDto(enviarAvisoSchema)
class EnviarAvisoDto extends EnviarAvisoDtoBase {}
class AlcanceAvisoQueryDto extends createZodDto(alcanceAvisoQuerySchema) {}
class AvisoEnviadoDto extends createZodDto(avisoEnviadoSchema) {}
class AlcanceAvisoDto extends createZodDto(alcanceAvisoSchema) {}

const TIME_EXEMPLO = '7c1e2a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const TEXTO_EXEMPLO = {
  titulo: 'Treino cancelado hoje',
  mensagem: 'Por causa da chuva, o treino das 19h está cancelado.',
}

const INVALIDO =
  '`VALIDATION_ERROR`: título (3–65) ou mensagem (3–500) fora dos limites; `timeId` ausente com `TIME`; destino inválido.'
const NAO_ENCONTRADO = '`NOT_FOUND`: time inexistente ou de outra atlética.'
const TIME_INVALIDO = '`TIME_INVALIDO_AVISO`: time adversário ou inativo.'

@ApiTags('Painel — Avisos')
@ApiUnauthorizedResponse({ description: '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.' })
@ApiForbiddenResponse({ description: '`FORBIDDEN`: exige DIRETOR ou superior.' })
@PapelMinimo(Papel.DIRETOR)
@Controller('avisos')
export class AvisosController {
  constructor(private readonly avisos: AvisosService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Envia um aviso push para todos os usuários ou para o elenco atual de um time',
    description:
      'Respeita a preferência "Avisos da diretoria" e grava `AVISO_ENVIADO` na auditoria, mesmo ' +
      'com 0 destinatários. Limite: 10 avisos por hora por remetente.',
  })
  @ApiBody({
    type: EnviarAvisoDto,
    examples: {
      todos: { value: { destino: 'TODOS', ...TEXTO_EXEMPLO } },
      time: { value: { destino: 'TIME', timeId: TIME_EXEMPLO, ...TEXTO_EXEMPLO } },
    },
  })
  @ApiAcceptedResponse({
    type: AvisoEnviadoDto,
    example: {
      avisoId: '3b9f6c1d-2a4e-4b7f-9c8d-1e2f3a4b5c6d',
      destinatarios: 7,
      enviadoEm: '2026-10-01T21:00:00.000Z',
    },
  })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiUnprocessableEntityResponse({ description: TIME_INVALIDO })
  @ApiTooManyRequestsResponse({
    description: '`RATE_LIMITED`: mais de 10 avisos na última hora; `Retry-After` em segundos.',
  })
  enviar(
    @Body() aviso: EnviarAvisoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<AvisoEnviado> {
    return this.avisos.enviar(usuario, aviso as EnviarAviso)
  }

  @Get('alcance')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Prévia de quantas pessoas receberão o aviso',
    description: 'Mesmo filtro do envio: preferência ativa e aparelho registrado.',
  })
  @ApiOkResponse({ type: AlcanceAvisoDto, example: { destinatarios: 142 } })
  @ApiBadRequestResponse({
    description:
      '`VALIDATION_ERROR`: destino inválido; `timeId` ausente com `TIME` ou presente com `TODOS`.',
  })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiUnprocessableEntityResponse({ description: TIME_INVALIDO })
  alcance(
    @Query() destino: AlcanceAvisoQueryDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<AlcanceAviso> {
    return this.avisos.alcance(usuario, destino)
  }
}
