import { atleticaPublicaSchema, type AtleticaPublica } from '@atletica/shared'
import { Controller, Get, Header } from '@nestjs/common'
import { ApiNotModifiedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { Publico } from '../auth/decorators/publico.decorator'
import { AtleticaPadraoService } from './atletica-padrao.service'

class AtleticaPublicaDto extends createZodDto(atleticaPublicaSchema) {}

const EXEMPLO: AtleticaPublica = {
  id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
  nome: 'Atlética Exemplo',
  sigla: 'EXEMPLO',
  curso: 'Ciência da Computação e Inteligência Artificial',
  logoUrl: 'https://img.exemplo.com/atleticas/exemplo/logo.png',
  corPrimaria: '#E11D48',
  corSecundaria: '#2563EB',
  contatoEmail: 'diretoria@exemplo.com',
  contatoInstagram: '@atleticaexemplo',
  contatoWhatsapp: '+5598999999999',
}

@ApiTags('Atlética')
@Controller('atletica')
export class AtleticasController {
  constructor(private readonly atleticaPadrao: AtleticaPadraoService) {}

  /** Pública: a tela de login já usa a marca (RNF20). O `ETag`/304 vem do Express. */
  @Publico()
  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Marca e contato público da atlética padrão' })
  @ApiOkResponse({ type: AtleticaPublicaDto, example: EXEMPLO })
  @ApiNotModifiedResponse({ description: '`If-None-Match` igual ao `ETag` atual; sem corpo.' })
  obter(): Promise<AtleticaPublica> {
    return this.atleticaPadrao.obter()
  }
}
