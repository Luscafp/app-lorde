import {
  dispositivoRegistradoSchema,
  idParamSchema,
  registrarDispositivoSchema,
  type DispositivoRegistrado,
} from '@atletica/shared'
import { Body, Controller, Delete, Header, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { UsuarioAtual } from '../../auth/decorators/usuario-atual.decorator'
import type { UsuarioAutenticado } from '../../auth/tipos'
import { DispositivosService } from './dispositivos.service'

class RegistrarDispositivoDto extends createZodDto(registrarDispositivoSchema) {}
class DispositivoRegistradoDto extends createZodDto(dispositivoRegistradoSchema) {}
class DispositivoIdDto extends createZodDto(idParamSchema) {}

/** Recurso da própria conta (sem `atleticaId`): não existe 403 nem 404 de atlética. */
@ApiTags('Notificações')
@ApiUnauthorizedResponse({ description: '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.' })
@Controller('me/dispositivos')
export class DispositivosController {
  constructor(private readonly dispositivos: DispositivosService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Registra o aparelho para receber push (UC07 passo 4)',
    description:
      'Upsert por `tokenPush`: um token de outra conta passa para o usuário atual. Grava a ' +
      'sessão do access token e atualiza `ultimoUsoEm`; o app chama a cada abertura.',
  })
  @ApiBody({
    type: RegistrarDispositivoDto,
    examples: {
      android: {
        value: { tokenPush: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', plataforma: 'android' },
      },
    },
  })
  @ApiOkResponse({
    type: DispositivoRegistradoDto,
    example: {
      id: '3f0c6a9e-2b7d-4c1a-9e8f-5d4c3b2a1f0e',
      ultimoUsoEm: '2026-10-01T12:00:00.000Z',
    },
  })
  @ApiBadRequestResponse({
    description:
      '`VALIDATION_ERROR`: token fora do formato, plataforma diferente de android ou campo extra.',
  })
  registrar(
    @Body() dados: RegistrarDispositivoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<DispositivoRegistrado> {
    return this.dispositivos.registrar(usuario, dados)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Remove o aparelho (logout no app, UC08)' })
  @ApiNoContentResponse({ description: 'Removido.' })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não-UUID.' })
  @ApiNotFoundResponse({ description: '`NOT_FOUND`: inexistente ou de outro usuário.' })
  remover(
    @Param() { id }: DispositivoIdDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.dispositivos.remover(usuario.id, id)
  }
}
