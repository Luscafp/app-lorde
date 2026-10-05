import {
  ehDiretoria,
  listaModalidadesSchema,
  modalidadeCreateSchema,
  modalidadeIdSchema,
  modalidadeSchema,
  modalidadesQuerySchema,
  modalidadeUpdateSchema,
  Papel,
  type ListaModalidades,
  type Modalidade,
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
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { PapelMinimo } from '../auth/decorators/papel-minimo.decorator'
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator'
import { ModalidadesService } from './modalidades.service'

class ModalidadeCriacaoDto extends createZodDto(modalidadeCreateSchema) {}
class ModalidadeAtualizacaoDto extends createZodDto(modalidadeUpdateSchema) {}
class ModalidadesQueryDto extends createZodDto(modalidadesQuerySchema) {}
class ModalidadeIdDto extends createZodDto(modalidadeIdSchema) {}
class ModalidadeDto extends createZodDto(modalidadeSchema) {}
class ListaModalidadesDto extends createZodDto(listaModalidadesSchema) {}

const EXEMPLO: Modalidade = {
  id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
  nome: 'Handebol',
  icone: 'handball',
  ativa: true,
}

const NAO_AUTENTICADO = '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.'
const NAO_ENCONTRADA = '`NOT_FOUND`: modalidade inexistente.'
const ID_INVALIDO = '`VALIDATION_ERROR`: corpo inválido, ícone fora do catálogo ou id não-UUID.'

@ApiTags('Modalidades')
@ApiUnauthorizedResponse({ description: NAO_AUTENTICADO })
@Controller('modalidades')
export class ModalidadesController {
  constructor(private readonly modalidades: ModalidadesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Lista as modalidades em ordem alfabética, sem paginação',
    description: '`incluirInativas=true` só vale para a Diretoria; para os demais é ignorado.',
  })
  @ApiOkResponse({ type: ListaModalidadesDto, example: { items: [EXEMPLO] } })
  async listar(
    @Query() { incluirInativas }: ModalidadesQueryDto,
    @UsuarioAtual('papel') papel: Papel,
  ): Promise<ListaModalidades> {
    const items = await this.modalidades.listar(incluirInativas && ehDiretoria(papel))
    return { items }
  }

  @Post()
  @PapelMinimo(Papel.DIRETOR)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Cadastra uma modalidade (nasce ativa)' })
  @ApiBody({
    type: ModalidadeCriacaoDto,
    examples: { handebol: { value: { nome: 'Handebol', icone: 'handball' } } },
  })
  @ApiCreatedResponse({ type: ModalidadeDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: ID_INVALIDO })
  @ApiConflictResponse({ description: '`MODALIDADE_DUPLICADA` (sem diferenciar maiúsculas).' })
  criar(@Body() dados: ModalidadeCriacaoDto): Promise<Modalidade> {
    return this.modalidades.criar(dados)
  }

  @Patch(':id')
  @PapelMinimo(Papel.DIRETOR)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Altera nome, ícone e/ou ativa (ao menos um campo)' })
  @ApiOkResponse({ type: ModalidadeDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: ID_INVALIDO })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADA })
  @ApiConflictResponse({ description: '`MODALIDADE_DUPLICADA`.' })
  atualizar(
    @Param() { id }: ModalidadeIdDto,
    @Body() dados: ModalidadeAtualizacaoDto,
  ): Promise<Modalidade> {
    return this.modalidades.atualizar(id, dados)
  }

  @Delete(':id')
  @PapelMinimo(Papel.PRESIDENTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Exclui a modalidade sem times vinculados (exclusão física)' })
  @ApiNoContentResponse({ description: 'Excluída.' })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não-UUID.' })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADA })
  @ApiConflictResponse({
    description: '`MODALIDADE_COM_DEPENDENCIAS`: há times vinculados; desative em vez de excluir.',
  })
  excluir(@Param() { id }: ModalidadeIdDto): Promise<void> {
    return this.modalidades.excluir(id)
  }
}
