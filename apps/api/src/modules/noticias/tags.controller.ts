import { listaTagsSchema, tagsQuerySchema, type ListaTags } from '@atletica/shared'
import { Controller, Get, Header, Query } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator'
import type { UsuarioAutenticado } from '../auth/tipos'
import { TagsService } from './tags.service'

class TagsQueryDto extends createZodDto(tagsQuerySchema) {}
class ListaTagsDto extends createZodDto(listaTagsSchema) {}

const EXEMPLO: ListaTags = {
  items: [{ id: 'd2f1a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b', nome: 'Futsal', totalNoticias: 4 }],
  page: 1,
  limit: 50,
  total: 1,
}

// Qualquer papel lê (convenções §9): não há caso 403.
@ApiTags('Notícias')
@ApiUnauthorizedResponse({ description: '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.' })
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Tags de notícias da atlética, por nome (UC05, RF10)',
    description:
      '`q` busca no nome sem diferenciar acentos nem maiúsculas. `emUso` (padrão `true`) traz só ' +
      'tags com notícia publicada; `emUso=false` vale do Diretor para cima e é ignorado para o ' +
      'Atleta (RN24). `totalNoticias` conta só publicadas e não excluídas.',
  })
  @ApiOkResponse({ type: ListaTagsDto, example: EXEMPLO })
  @ApiBadRequestResponse({
    description: '`VALIDATION_ERROR`: `emUso`, `q` (até 30) ou paginação inválidos.',
  })
  listar(
    @Query() query: TagsQueryDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<ListaTags> {
    return this.tags.listar(usuario, query)
  }
}
