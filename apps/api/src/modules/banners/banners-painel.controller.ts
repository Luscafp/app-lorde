import {
  bannerCreateSchema,
  bannerPainelSchema,
  bannersOrdemSchema,
  bannersOrdenadosSchema,
  bannersPainelQuerySchema,
  bannerUpdateSchema,
  idParamSchema,
  listaBannersPainelSchema,
  Papel,
  type BannerPainelDto,
  type BannersOrdenados,
  type ListaBannersPainel,
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
  Put,
  Query,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
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
import { BannersService } from './banners.service'

class BannerCriacaoDto extends createZodDto(bannerCreateSchema) {}
class BannerAtualizacaoDto extends createZodDto(bannerUpdateSchema) {}
class BannersOrdemDto extends createZodDto(bannersOrdemSchema) {}
class BannersPainelQueryDto extends createZodDto(bannersPainelQuerySchema) {}
class BannerIdDto extends createZodDto(idParamSchema) {}
class BannerPainelRespostaDto extends createZodDto(bannerPainelSchema) {}
class ListaBannersPainelDto extends createZodDto(listaBannersPainelSchema) {}
class BannersOrdenadosDto extends createZodDto(bannersOrdenadosSchema) {}

const ATLETICA_EXEMPLO = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const DIRETOR_EXEMPLO = 'c9d8e7f6-a5b4-4c3d-9e2f-1a0b9c8d7e6f'
const CHAVE_EXEMPLO = `atleticas/${ATLETICA_EXEMPLO}/banners/${DIRETOR_EXEMPLO}/9a2e4b1d-4c7e-4a3f-9d6b-8e1c4a7f0f5c.webp`

const EXEMPLO: BannerPainelDto = {
  id: '1f0c2a52-8e5d-4a43-9d6c-1f0f3c2b7a90',
  titulo: 'Inscrições abertas para o JUBS',
  imagemUrl: `https://img.exemplo.com/${CHAVE_EXEMPLO}`,
  link: 'https://forms.gle/abc',
  ordem: 4,
  ativo: true,
  criadoEm: '2026-10-01T12:00:00.000Z',
  atualizadoEm: '2026-10-01T12:00:00.000Z',
}

const SEM_PERMISSAO = '`FORBIDDEN`: exige DIRETOR ou superior.'
const NAO_ENCONTRADO = '`NOT_FOUND`: inexistente ou de outra atlética.'
const INVALIDO = '`VALIDATION_ERROR`: título, link (não `https://`) ou id inválidos; campo extra.'
const ERROS_IMAGEM =
  '`UPLOAD_INVALIDO` (chave de outra atlética, finalidade ou usuário; tamanho ou tipo) ou ' +
  '`UPLOAD_NAO_ENCONTRADO` (upload não concluído).'
const LIMITE = '`LIMITE_BANNERS_ATIVOS`: já existem 10 banners ativos.'

@ApiTags('Painel — Banners')
@ApiUnauthorizedResponse({ description: '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.' })
@ApiForbiddenResponse({ description: SEM_PERMISSAO })
@PapelMinimo(Papel.DIRETOR)
@Controller('painel/banners')
export class BannersPainelController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Todos os banners, ativos e inativos, por `ordem`' })
  @ApiOkResponse({
    type: ListaBannersPainelDto,
    example: { items: [EXEMPLO], page: 1, limit: 20, total: 1 },
  })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: paginação inválida.' })
  listar(@Query() query: BannersPainelQueryDto): Promise<ListaBannersPainel> {
    return this.banners.listar(query)
  }

  @Put('ordem')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Regrava a ordem (0..n-1) de uma vez',
    description: '`ids` deve conter exatamente todos os banners da atlética, ativos e inativos.',
  })
  @ApiBody({ type: BannersOrdemDto, examples: { ordem: { value: { ids: [EXEMPLO.id] } } } })
  @ApiOkResponse({ type: BannersOrdenadosDto, example: { items: [EXEMPLO] } })
  @ApiBadRequestResponse({
    description: '`VALIDATION_ERROR` ou `ORDEM_INCOMPLETA` (faltam, sobram ou repetem ids).',
  })
  ordenar(
    @Body() { ids }: BannersOrdemDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<BannersOrdenados> {
    return this.banners.ordenar(usuario, ids)
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Banner para edição' })
  @ApiOkResponse({ type: BannerPainelRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  detalhar(@Param() { id }: BannerIdDto): Promise<BannerPainelDto> {
    return this.banners.detalhar(id)
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Cadastra um banner no fim da ordem',
    description: '`imagemKey` é a chave do presign com finalidade `BANNER`. `ativo` padrão `true`.',
  })
  @ApiBody({
    type: BannerCriacaoDto,
    examples: {
      banner: {
        value: { titulo: EXEMPLO.titulo, imagemKey: CHAVE_EXEMPLO, link: EXEMPLO.link },
      },
    },
  })
  @ApiCreatedResponse({ type: BannerPainelRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiConflictResponse({ description: LIMITE })
  @ApiUnprocessableEntityResponse({ description: ERROS_IMAGEM })
  criar(
    @Body() dados: BannerCriacaoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<BannerPainelDto> {
    return this.banners.criar(usuario, dados)
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Altera título, imagem, link e/ou situação (ao menos um campo)',
    description:
      '`link: null` remove o link. A imagem só é validada quando muda; a anterior sai do R2.',
  })
  @ApiOkResponse({ type: BannerPainelRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiConflictResponse({ description: LIMITE })
  @ApiUnprocessableEntityResponse({ description: ERROS_IMAGEM })
  atualizar(
    @Param() { id }: BannerIdDto,
    @Body() dados: BannerAtualizacaoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<BannerPainelDto> {
    return this.banners.atualizar(id, usuario, dados)
  }

  @Delete(':id')
  @PapelMinimo(Papel.PRESIDENTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Exclui o banner (exclusão física)' })
  @ApiNoContentResponse({ description: 'Excluído.' })
  @ApiForbiddenResponse({ description: '`FORBIDDEN`: exige PRESIDENTE ou VICE_PRESIDENTE.' })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não-UUID.' })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  excluir(
    @Param() { id }: BannerIdDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.banners.excluir(id, usuario)
  }
}
