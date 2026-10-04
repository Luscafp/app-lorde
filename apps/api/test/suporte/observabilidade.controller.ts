import { Body, Controller, Get, HttpCode, Logger, Param, Post } from '@nestjs/common'
import { ErroNegocio } from '../../src/common/erros/erro-negocio'
import { ContextoAtletica } from '../../src/infra/contexto/contexto-atletica.service'

export const USUARIO_TESTE = '6f1c3a2b-0d4e-4f5a-8b6c-7d8e9f0a1b2c'
export const ATLETICA_TESTE = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

/** Controller usado só nos testes de integração de observabilidade (#48). */
@Controller('suporte')
export class ObservabilidadeController {
  private readonly logger = new Logger(ObservabilidadeController.name)

  constructor(private readonly contexto: ContextoAtletica) {}

  /** Imita o login (#57 ainda não existe): loga o corpo para exercitar a redação. */
  @Post('auth/login')
  @HttpCode(200)
  login(@Body() corpo: { email: string; senha: string }): { accessToken: string } {
    this.logger.log({ corpo }, 'Tentativa de login')
    return { accessToken: 'token-secreto' }
  }

  @Get('eventos/:id')
  evento(@Param('id') id: string): { id: string } {
    return { id }
  }

  /** Faz o papel do `JwtAuthGuard` (#7), que ainda não existe, e então falha. */
  @Get('autenticada/erro')
  erroAutenticado(): never {
    this.contexto.definir({ atleticaId: ATLETICA_TESTE, usuarioId: USUARIO_TESTE })
    throw new Error('falha de fulano@ufma.br')
  }

  @Get('conflito')
  conflito(): never {
    throw new ErroNegocio(409, 'CONFLITO_TESTE', 'Conflito.')
  }
}
