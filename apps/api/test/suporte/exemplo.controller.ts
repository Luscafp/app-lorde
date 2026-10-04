import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { paginacaoQuerySchema } from '@atletica/shared'
import { createZodDto } from 'nestjs-zod'
import { ErroNegocio } from '../../src/common/erros/erro-negocio'
import { Publico } from '../../src/modules/auth/decorators/publico.decorator'

class ExemploDto extends createZodDto(paginacaoQuerySchema) {}

/** Controller usado só nos testes de integração da plataforma (#1). */
@Publico()
@Controller('exemplo')
export class ExemploController {
  @Post('validacao')
  @HttpCode(200)
  validar(@Body() corpo: ExemploDto): ExemploDto {
    return corpo
  }

  @Get('conflito')
  conflito(): never {
    throw new ErroNegocio(409, 'EXEMPLO_CONFLITO', 'Mensagem')
  }

  @Get('erro')
  erro(): never {
    throw new Error('x')
  }

  @Post('corpo')
  @HttpCode(200)
  corpo(): { ok: true } {
    return { ok: true }
  }
}
