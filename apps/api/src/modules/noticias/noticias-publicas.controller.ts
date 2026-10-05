import {
  listaNoticiasSchema,
  listarNoticiasQuerySchema,
  noticiaDetalheSchema,
  noticiaIdParamSchema,
  type ListaNoticias,
  type NoticiaDetalheDto,
} from '@atletica/shared'
import { Controller, Get, Header, Param, Query } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { NoticiasPublicasService } from './noticias-publicas.service'

class ListarNoticiasQueryDto extends createZodDto(listarNoticiasQuerySchema) {}
class NoticiaIdParamDto extends createZodDto(noticiaIdParamSchema) {}
class ListaNoticiasDto extends createZodDto(listaNoticiasSchema) {}
class NoticiaDetalheRespostaDto extends createZodDto(noticiaDetalheSchema) {}

const ID_EXEMPLO = 'b7e1c0de-5a4f-4e2d-8b6a-9c0d1e2f3a4b'
const TITULO_EXEMPLO = 'Atlética é campeã do torneio de vôlei'
const CAPA_EXEMPLO = `https://img.exemplo.com/atleticas/exemplo/noticias/${ID_EXEMPLO}.jpg`

const EXEMPLO_LISTA: ListaNoticias = {
  items: [
    {
      id: ID_EXEMPLO,
      titulo: TITULO_EXEMPLO,
      imagemCapaUrl: CAPA_EXEMPLO,
      publicadaEm: '2026-09-28T18:00:00.000Z',
      resumo: 'A equipe venceu a final por 3 sets a 1 no ginásio…',
    },
  ],
  page: 1,
  limit: 20,
  total: 45,
}

const EXEMPLO_DETALHE: NoticiaDetalheDto = {
  id: ID_EXEMPLO,
  titulo: TITULO_EXEMPLO,
  conteudo: 'A equipe **venceu** a final por 3 sets a 1.\n\nO próximo desafio…',
  imagemCapaUrl: CAPA_EXEMPLO,
  publicadaEm: '2026-09-28T18:00:00.000Z',
}

@ApiTags('Notícias')
@ApiUnauthorizedResponse({ description: '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.' })
@Controller('noticias')
export class NoticiasPublicasController {
  constructor(private readonly noticias: NoticiasPublicasService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Lista as notícias publicadas, da mais recente para a mais antiga (UC05)',
    description:
      'Só publicadas e não excluídas (RN24). Ordem `publicadaEm` decrescente, desempate por ' +
      '`id`. `resumo`: até 160 caracteres do conteúdo em texto puro.',
  })
  @ApiOkResponse({ type: ListaNoticiasDto, example: EXEMPLO_LISTA })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: `page` < 1 ou `limit` fora de 1–50.' })
  listar(@Query() query: ListarNoticiasQueryDto): Promise<ListaNoticias> {
    return this.noticias.listar(query)
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Notícia publicada completa',
    description: '`conteudo` em Markdown restrito, renderizado pelo app.',
  })
  @ApiOkResponse({ type: NoticiaDetalheRespostaDto, example: EXEMPLO_DETALHE })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não é UUID.' })
  @ApiNotFoundResponse({
    description: '`NOT_FOUND`: inexistente, rascunho, excluída ou de outra atlética.',
  })
  detalhar(@Param() { id }: NoticiaIdParamDto): Promise<NoticiaDetalheDto> {
    return this.noticias.detalhar(id)
  }
}
