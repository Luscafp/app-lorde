import {
  capitaoUpdateSchema,
  ehDiretoria,
  elencoDtoSchema,
  membroElencoParamsSchema,
  Papel,
  timeDtoSchema,
  timeIdSchema,
  type ElencoDto,
  type TimeDto,
} from '@atletica/shared'
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { PapelMinimo } from '../auth/decorators/papel-minimo.decorator'
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator'
import type { UsuarioAutenticado } from '../auth/tipos'
import { ElencoService } from './elenco.service'

class TimeIdDto extends createZodDto(timeIdSchema) {}
class MembroElencoParamsDto extends createZodDto(membroElencoParamsSchema) {}
class CapitaoAtualizacaoDto extends createZodDto(capitaoUpdateSchema) {}
class ElencoRespostaDto extends createZodDto(elencoDtoSchema) {}
class TimeRespostaDto extends createZodDto(timeDtoSchema) {}

const EXEMPLO_ELENCO: ElencoDto = {
  items: [
    {
      usuarioId: 'c9d8e7f6-a5b4-4c3d-9e2f-1a0b9c8d7e6f',
      nome: 'Ana Souza',
      fotoUrl: 'https://img.exemplo.com/usuarios/c9d8/perfil/foto.jpg',
      entradaEm: '2026-08-10T13:00:00.000Z',
      capitao: true,
    },
  ],
  total: 1,
}

const NAO_AUTENTICADO = '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.'
const NAO_ENCONTRADO = '`NOT_FOUND`: time inexistente ou de outra atlética que usa o aplicativo.'
const ADVERSARIO = '`TIME_ADVERSARIO`: times adversários não têm elenco nem capitão.'

@ApiTags('Times')
@ApiUnauthorizedResponse({ description: NAO_AUTENTICADO })
@Controller('times')
export class ElencoController {
  constructor(private readonly elenco: ElencoService) {}

  @Get(':id/elenco')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Elenco atual do time, capitão primeiro e depois por nome',
    description: 'Sem paginação. Fora da Diretoria, time inativo ou de modalidade inativa → 404.',
  })
  @ApiOkResponse({ type: ElencoRespostaDto, example: EXEMPLO_ELENCO })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não-UUID.' })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiUnprocessableEntityResponse({ description: ADVERSARIO })
  listar(
    @Param() { id }: TimeIdDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<ElencoDto> {
    return this.elenco.listar(id, ehDiretoria(usuario.papel))
  }

  @Delete(':id/elenco/:usuarioId')
  @PapelMinimo(Papel.DIRETOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Remove o membro do elenco',
    description:
      'Preenche `saidaEm`, tira a capitania se for o capitão e apaga as confirmações em eventos ' +
      'agendados futuros sem presença.',
  })
  @ApiNoContentResponse({ description: 'Removido.' })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não-UUID.' })
  @ApiNotFoundResponse({
    description: `${NAO_ENCONTRADO} \`MEMBRO_NAO_ENCONTRADO\`: sem vínculo ativo no time.`,
  })
  @ApiUnprocessableEntityResponse({ description: ADVERSARIO })
  remover(
    @Param() { id, usuarioId }: MembroElencoParamsDto,
    @UsuarioAtual('id') executorId: string,
  ): Promise<void> {
    return this.elenco.removerMembro(id, usuarioId, executorId)
  }

  @Put(':id/capitao')
  @PapelMinimo(Papel.DIRETOR)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Define ou remove (`usuarioId: null`) o capitão',
    description: 'O novo capitão substitui o anterior e precisa ser membro do elenco atual.',
  })
  @ApiOkResponse({ type: TimeRespostaDto })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: corpo inválido ou id não-UUID.' })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiUnprocessableEntityResponse({ description: `${ADVERSARIO} \`CAPITAO_FORA_DO_ELENCO\`.` })
  definirCapitao(
    @Param() { id }: TimeIdDto,
    @Body() { usuarioId }: CapitaoAtualizacaoDto,
    @UsuarioAtual('atleticaId') atleticaId: string,
  ): Promise<TimeDto> {
    return this.elenco.definirCapitao(id, usuarioId, atleticaId)
  }
}
