import {
  ehDiretoria,
  listaTimesSchema,
  Papel,
  timeCreateSchema,
  timeDetalheDtoSchema,
  timeDtoSchema,
  timeIdSchema,
  timesQuerySchema,
  timeUpdateSchema,
  type ListaTimes,
  type TimeDetalheDto,
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
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import { TimesService } from './times.service'

class TimeCriacaoDto extends createZodDto(timeCreateSchema) {}
class TimeAtualizacaoDto extends createZodDto(timeUpdateSchema) {}
class TimesQueryDto extends createZodDto(timesQuerySchema) {}
class TimeIdDto extends createZodDto(timeIdSchema) {}
class TimeRespostaDto extends createZodDto(timeDtoSchema) {}
class TimeDetalheRespostaDto extends createZodDto(timeDetalheDtoSchema) {}
class ListaTimesDto extends createZodDto(listaTimesSchema) {}

const EXEMPLO: TimeDto = {
  id: 'b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  nome: 'Futsal Masculino',
  ativo: true,
  modalidade: { id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11', nome: 'Futsal', icone: 'soccer' },
  atletica: {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    nome: 'Atlética Exemplo',
    sigla: 'EXEMPLO',
    propria: true,
  },
  capitao: { id: 'c9d8e7f6-a5b4-4c3d-9e2f-1a0b9c8d7e6f', nome: 'Ana Souza' },
  totalMembros: 14,
}

const NAO_AUTENTICADO = '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.'
const NAO_ENCONTRADO = '`NOT_FOUND`: time inexistente ou de outra atlética que usa o aplicativo.'
const INVALIDO = '`VALIDATION_ERROR`: corpo inválido, campo extra ou id não-UUID.'

@ApiTags('Times')
@ApiUnauthorizedResponse({ description: NAO_AUTENTICADO })
@Controller('times')
export class TimesController {
  constructor(private readonly times: TimesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Lista times próprios ou adversários, ordenados por modalidade e nome',
    description:
      'Sem `incluirInativos`, só times ativos de modalidades ativas. `incluirInativos=true` só ' +
      'vale para a Diretoria; para os demais é ignorado.',
  })
  @ApiOkResponse({
    type: ListaTimesDto,
    example: { items: [EXEMPLO], page: 1, limit: 20, total: 1 },
  })
  @ApiBadRequestResponse({ description: INVALIDO })
  listar(
    @Query() query: TimesQueryDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<ListaTimes> {
    const incluirInativos = query.incluirInativos && ehDiretoria(usuario.papel)
    return this.times.listar(usuario.atleticaId, { ...query, incluirInativos })
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Detalhe do time, com a situação do usuário',
    description:
      'Fora da Diretoria, time inativo ou de modalidade inativa responde 404. `minhaSituacao` é ' +
      '`null` em time adversário.',
  })
  @ApiOkResponse({
    type: TimeDetalheRespostaDto,
    example: { ...EXEMPLO, minhaSituacao: { membro: true, solicitacaoPendente: null } },
  })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  detalhar(
    @Param() { id }: TimeIdDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<TimeDetalheDto> {
    return this.times.detalhar(id, usuario, ehDiretoria(usuario.papel))
  }

  @Post()
  @PapelMinimo(Papel.DIRETOR)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Cadastra um time da atlética ativa ou de uma atlética adversária',
    description: 'Sem `atleticaAdversariaId`, o time é da atlética ativa. Nasce ativo.',
  })
  @ApiBody({
    type: TimeCriacaoDto,
    examples: {
      proprio: { value: { nome: 'Futsal Masculino', modalidadeId: EXEMPLO.modalidade.id } },
    },
  })
  @ApiCreatedResponse({ type: TimeRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiNotFoundResponse({
    description: '`NOT_FOUND`: modalidade ou atlética adversária inexistente.',
  })
  @ApiConflictResponse({ description: '`TIME_DUPLICADO` (atlética + modalidade + nome).' })
  @ApiUnprocessableEntityResponse({ description: '`MODALIDADE_INATIVA`.' })
  criar(
    @Body() dados: TimeCriacaoDto,
    @UsuarioAtual('atleticaId') atleticaId: string,
  ): Promise<TimeDto> {
    return this.times.criar(atleticaId, dados)
  }

  @Patch(':id')
  @PapelMinimo(Papel.DIRETOR)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Altera nome, modalidade e/ou ativo (ao menos um campo)',
    description: 'A atlética do time é imutável.',
  })
  @ApiOkResponse({ type: TimeRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiConflictResponse({
    description: '`TIME_DUPLICADO`; `TIME_COM_EVENTOS` ao trocar a modalidade de time com eventos.',
  })
  @ApiUnprocessableEntityResponse({ description: '`MODALIDADE_INATIVA`.' })
  atualizar(
    @Param() { id }: TimeIdDto,
    @Body() dados: TimeAtualizacaoDto,
    @UsuarioAtual('atleticaId') atleticaId: string,
  ): Promise<TimeDto> {
    return this.times.atualizar(id, atleticaId, dados)
  }

  @Delete(':id')
  @PapelMinimo(Papel.PRESIDENTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Exclui o time sem dependências (exclusão física)' })
  @ApiNoContentResponse({ description: 'Excluído.' })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não-UUID.' })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiConflictResponse({
    description: '`TIME_COM_DEPENDENCIAS`: há eventos, membros ou solicitações; desative.',
  })
  excluir(@Param() { id }: TimeIdDto): Promise<void> {
    return this.times.excluir(id)
  }
}
