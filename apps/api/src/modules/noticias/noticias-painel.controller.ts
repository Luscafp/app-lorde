import {
  idParamSchema,
  listaNoticiasPainelSchema,
  noticiaCreateSchema,
  noticiaPainelDetalheSchema,
  noticiasPainelQuerySchema,
  noticiaUpdateSchema,
  Papel,
  type ListaNoticiasPainel,
  type NoticiaPainelDetalheDto,
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
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
import { NoticiasPainelService } from './noticias-painel.service'

class NoticiaCriacaoDto extends createZodDto(noticiaCreateSchema) {}
class NoticiaAtualizacaoDto extends createZodDto(noticiaUpdateSchema) {}
class NoticiasPainelQueryDto extends createZodDto(noticiasPainelQuerySchema) {}
class NoticiaIdDto extends createZodDto(idParamSchema) {}
class NoticiaPainelRespostaDto extends createZodDto(noticiaPainelDetalheSchema) {}
class ListaNoticiasPainelDto extends createZodDto(listaNoticiasPainelSchema) {}

const ATLETICA_EXEMPLO = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const AUTOR_EXEMPLO = 'c9d8e7f6-a5b4-4c3d-9e2f-1a0b9c8d7e6f'
const CHAVE_EXEMPLO = `atleticas/${ATLETICA_EXEMPLO}/noticias/${AUTOR_EXEMPLO}/0f5c8e2a-4b1d-4c7e-9a3f-2d6b8e1c4a7f.webp`

const EXEMPLO: NoticiaPainelDetalheDto = {
  id: 'b7e1c0de-5a4f-4e2d-8b6a-9c0d1e2f3a4b',
  titulo: 'Seletiva de futsal',
  conteudo: 'Inscrições até **sexta**.',
  status: 'PUBLICADA',
  imagemCapaUrl: `https://img.exemplo.com/${CHAVE_EXEMPLO}`,
  publicadaEm: '2026-09-30T12:00:00.000Z',
  criadoEm: '2026-09-29T18:00:00.000Z',
  atualizadoEm: '2026-09-30T12:00:00.000Z',
  autor: { id: AUTOR_EXEMPLO, nome: 'Maria Diretora' },
  tags: [
    { id: 'd2f1a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b', nome: 'Futsal' },
    { id: 'e3a2b4c5-6d7e-4f80-9b1c-2d3e4f5a6b7c', nome: 'Seletiva' },
  ],
}

const { conteudo: _, ...ITEM_EXEMPLO } = EXEMPLO

const NAO_AUTENTICADO = '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.'
const SEM_PERMISSAO = '`FORBIDDEN`: exige DIRETOR ou superior.'
const NAO_ENCONTRADA = '`NOT_FOUND`: inexistente, excluída ou de outra atlética.'
const INVALIDO = '`VALIDATION_ERROR`: corpo inválido, campo extra ou id não-UUID.'
const ERROS_CAPA =
  '`UPLOAD_INVALIDO` (chave de outra atlética, finalidade ou usuário; tamanho ou tipo) ou ' +
  '`UPLOAD_NAO_ENCONTRADO` (upload não concluído).'
const TAGS_POR_NOME =
  '`tags`: até 5 nomes (2–30 caracteres: letras, números, espaço e hífen); a tag é criada na ' +
  'atlética se não existir, reaproveitada sem diferenciar acentos nem maiúsculas.'
const ERROS_PUBLICACAO = '`CAPA_OBRIGATORIA` ou `CONTEUDO_OBRIGATORIO`.'

@ApiTags('Painel — Notícias')
@ApiUnauthorizedResponse({ description: NAO_AUTENTICADO })
@ApiForbiddenResponse({ description: SEM_PERMISSAO })
@PapelMinimo(Papel.DIRETOR)
@Controller('painel/noticias')
export class NoticiasPainelController {
  constructor(private readonly noticias: NoticiasPainelService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Lista rascunhos e publicadas, da edição mais recente para a mais antiga',
    description:
      '`q` busca no título sem diferenciar acentos nem maiúsculas; `tagId` filtra por tag. ' +
      'Excluídas não aparecem.',
  })
  @ApiOkResponse({
    type: ListaNoticiasPainelDto,
    example: { items: [ITEM_EXEMPLO], page: 1, limit: 20, total: 1 },
  })
  @ApiBadRequestResponse({
    description: '`VALIDATION_ERROR`: `status`, `q`, `tagId` ou paginação inválidos.',
  })
  listar(
    @Query() query: NoticiasPainelQueryDto,
    @UsuarioAtual('atleticaId') atleticaId: string,
  ): Promise<ListaNoticiasPainel> {
    return this.noticias.listar(atleticaId, query)
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Notícia completa para edição, em qualquer status' })
  @ApiOkResponse({ type: NoticiaPainelRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADA })
  detalhar(@Param() { id }: NoticiaIdDto): Promise<NoticiaPainelDetalheDto> {
    return this.noticias.detalhar(id)
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Cria um rascunho ou, com `publicar: true`, uma notícia já publicada',
    description:
      'O autor é o usuário logado. `imagemCapaKey` é a chave do presign com finalidade ' +
      '`NOTICIA`. Publicar exige conteúdo (após `trim`) e capa e emite `noticia.publicada`. ' +
      TAGS_POR_NOME,
  })
  @ApiBody({
    type: NoticiaCriacaoDto,
    examples: {
      rascunho: { value: { titulo: 'Seletiva de futsal' } },
      publicada: {
        value: {
          titulo: 'Seletiva de futsal',
          conteudo: 'Inscrições até **sexta**.',
          imagemCapaKey: CHAVE_EXEMPLO,
          tags: ['Futsal', 'Seletiva'],
          publicar: true,
        },
      },
    },
  })
  @ApiCreatedResponse({ type: NoticiaPainelRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiUnprocessableEntityResponse({ description: `${ERROS_PUBLICACAO} ${ERROS_CAPA}` })
  criar(
    @Body() dados: NoticiaCriacaoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<NoticiaPainelDetalheDto> {
    return this.noticias.criar(usuario, dados)
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Altera título, conteúdo, capa e/ou tags (ao menos um campo)',
    description:
      '`imagemCapaKey: null` remove a capa. Publicada continua publicada, com o mesmo ' +
      '`publicadaEm`, e precisa manter conteúdo e capa. A capa só é validada quando muda. ' +
      '`tags` substitui o conjunto (`[]` remove todas; omitido mantém as atuais). ' +
      TAGS_POR_NOME,
  })
  @ApiOkResponse({ type: NoticiaPainelRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADA })
  @ApiUnprocessableEntityResponse({
    description: `Publicada sem conteúdo ou capa: ${ERROS_PUBLICACAO} ${ERROS_CAPA}`,
  })
  atualizar(
    @Param() { id }: NoticiaIdDto,
    @Body() dados: NoticiaAtualizacaoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<NoticiaPainelDetalheDto> {
    return this.noticias.atualizar(id, usuario, dados)
  }

  @Post(':id/publicar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Publica o rascunho (idempotente)',
    description:
      'Na primeira publicação define `publicadaEm` e emite `noticia.publicada`; ao republicar, ' +
      'mantém a data original e não emite de novo. Já publicada: `200` sem efeitos.',
  })
  @ApiOkResponse({ type: NoticiaPainelRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADA })
  @ApiUnprocessableEntityResponse({ description: ERROS_PUBLICACAO })
  publicar(
    @Param() { id }: NoticiaIdDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<NoticiaPainelDetalheDto> {
    return this.noticias.publicar(id, usuario)
  }

  @Post(':id/despublicar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Volta a notícia para rascunho (idempotente)',
    description: 'Some imediatamente da leitura pública; `publicadaEm` é mantida.',
  })
  @ApiOkResponse({
    type: NoticiaPainelRespostaDto,
    example: { ...EXEMPLO, status: 'RASCUNHO' },
  })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADA })
  despublicar(
    @Param() { id }: NoticiaIdDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<NoticiaPainelDetalheDto> {
    return this.noticias.despublicar(id, usuario)
  }

  @Delete(':id')
  @PapelMinimo(Papel.PRESIDENTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Exclui a notícia (exclusão lógica), em qualquer status' })
  @ApiNoContentResponse({ description: 'Excluída.' })
  @ApiForbiddenResponse({ description: '`FORBIDDEN`: exige PRESIDENTE ou VICE_PRESIDENTE.' })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não-UUID.' })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADA })
  excluir(
    @Param() { id }: NoticiaIdDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.noticias.excluir(id, usuario)
  }
}
