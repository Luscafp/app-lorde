import { listaBannersSchema, type ListaBanners } from '@atletica/shared'
import { Controller, Get, Header } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { BannersService } from './banners.service'

class ListaBannersDto extends createZodDto(listaBannersSchema) {}

const EXEMPLO: ListaBanners = {
  items: [
    {
      id: '1f0c2a52-8e5d-4a43-9d6c-1f0f3c2b7a90',
      titulo: 'Inscrições abertas para o JUBS',
      imagemUrl: 'https://img.exemplo.com/atleticas/a1b2/banners/c9d8/1f0c.webp',
      link: 'https://forms.gle/abc',
    },
  ],
}

@ApiTags('Banners')
@ApiUnauthorizedResponse({ description: '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.' })
@Controller('banners')
export class BannersPublicosController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Banners ativos do carrossel da Home, na ordem definida (RN34)',
    description: 'Sem paginação: no máximo 10 ativos. `link` é `https://` ou `null`.',
  })
  @ApiOkResponse({ type: ListaBannersDto, example: EXEMPLO })
  listar(): Promise<ListaBanners> {
    return this.banners.listarAtivos()
  }
}
