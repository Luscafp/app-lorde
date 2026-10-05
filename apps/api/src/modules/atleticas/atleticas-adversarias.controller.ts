import {
  atleticaAdversariaDtoSchema,
  atleticaAdversariaIdSchema,
  atleticaAdversariaSchema,
  atleticaAdversariaUpdateSchema,
  atleticasAdversariasQuerySchema,
  listaAtleticasAdversariasSchema,
  Papel,
  type AtleticaAdversaria,
  type ListaAtleticasAdversarias,
} from '@atletica/shared'
import { Body, Controller, Get, Header, Param, Patch, Post, Query } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { PapelMinimo } from '../auth/decorators/papel-minimo.decorator'
import { AtleticasAdversariasService } from './atleticas-adversarias.service'

class AdversariaCriacaoDto extends createZodDto(atleticaAdversariaSchema) {}
class AdversariaAtualizacaoDto extends createZodDto(atleticaAdversariaUpdateSchema) {}
class AdversariasQueryDto extends createZodDto(atleticasAdversariasQuerySchema) {}
class AdversariaIdDto extends createZodDto(atleticaAdversariaIdSchema) {}
class AdversariaDto extends createZodDto(atleticaAdversariaDtoSchema) {}
class ListaAdversariasDto extends createZodDto(listaAtleticasAdversariasSchema) {}

const EXEMPLO: AtleticaAdversaria = {
  id: 'd4c3b2a1-6f5e-4b7a-9d8c-5d4c3b2a1f0e',
  nome: 'Atlética Fênix',
  sigla: 'FNX',
  curso: 'Engenharia',
  totalTimes: 2,
}

const INVALIDO =
  '`VALIDATION_ERROR`: corpo inválido, campo extra (ex.: `usaAplicativo`) ou id não-UUID.'
const DUPLICADA = '`ATLETICA_DUPLICADA` (sem diferenciar maiúsculas).'

@ApiTags('Atléticas adversárias')
@ApiUnauthorizedResponse({ description: '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.' })
@PapelMinimo(Papel.DIRETOR)
@Controller('atleticas-adversarias')
export class AtleticasAdversariasController {
  constructor(private readonly adversarias: AtleticasAdversariasService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Lista as atléticas adversárias por nome, com busca e paginação' })
  @ApiOkResponse({
    type: ListaAdversariasDto,
    example: { items: [EXEMPLO], page: 1, limit: 20, total: 1 },
  })
  @ApiBadRequestResponse({ description: INVALIDO })
  listar(@Query() query: AdversariasQueryDto): Promise<ListaAtleticasAdversarias> {
    return this.adversarias.listar(query)
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Cadastra uma atlética adversária (`usaAplicativo = false`)' })
  @ApiBody({
    type: AdversariaCriacaoDto,
    examples: { fenix: { value: { nome: 'Atlética Fênix', sigla: 'FNX', curso: 'Engenharia' } } },
  })
  @ApiCreatedResponse({ type: AdversariaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiConflictResponse({ description: DUPLICADA })
  criar(@Body() dados: AdversariaCriacaoDto): Promise<AtleticaAdversaria> {
    return this.adversarias.criar(dados)
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Altera nome, sigla e/ou curso (ao menos um campo)' })
  @ApiOkResponse({ type: AdversariaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiNotFoundResponse({
    description: '`NOT_FOUND`: inexistente ou atlética que usa o aplicativo.',
  })
  @ApiConflictResponse({ description: DUPLICADA })
  atualizar(
    @Param() { id }: AdversariaIdDto,
    @Body() dados: AdversariaAtualizacaoDto,
  ): Promise<AtleticaAdversaria> {
    return this.adversarias.atualizar(id, dados)
  }
}
