import { Body, Controller, Get, HttpCode, Logger, Param, Post } from '@nestjs/common'
import { ErroNegocio } from '../../src/common/erros/erro-negocio'
import { Publico } from '../../src/modules/auth/decorators/publico.decorator'

/** Controller usado só nos testes de integração de observabilidade (#48). */
@Controller('suporte')
export class ObservabilidadeController {
  private readonly logger = new Logger(ObservabilidadeController.name)

  /** Imita o login (#57 ainda não existe): loga o corpo para exercitar a redação. */
  @Publico()
  @Post('auth/login')
  @HttpCode(200)
  login(@Body() corpo: { email: string; senha: string }): { accessToken: string } {
    this.logger.log({ corpo }, 'Tentativa de login')
    return { accessToken: 'token-secreto' }
  }

  @Publico()
  @Get('eventos/:id')
  evento(@Param('id') id: string): { id: string } {
    return { id }
  }

  @Get('autenticada/erro')
  erroAutenticado(): never {
    throw new Error('falha de fulano@ufma.br')
  }

  @Publico()
  @Get('conflito')
  conflito(): never {
    throw new ErroNegocio(409, 'CONFLITO_TESTE', 'Conflito.')
  }
}
