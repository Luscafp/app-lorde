import {
  respostaEnvioVerificacaoSchema,
  respostaVerificarEmailSchema,
  VALIDADE_CODIGO_VERIFICACAO_MS,
  verificarEmailSchema,
  type RespostaEnvioVerificacao,
  type RespostaVerificarEmail,
} from '@atletica/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Post } from '@nestjs/common'
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { RESPOSTA_LIMITE_EXCEDIDO } from '../../../common/swagger/respostas'
import { HORA_MS } from '../../../common/tempo'
import { UsuarioAtual } from '../decorators/usuario-atual.decorator'
import type { UsuarioAutenticado } from '../tipos'
import {
  INTERVALO_ENVIO,
  LIMITE_ENVIOS_HORA,
  MAXIMO_TENTATIVAS_VERIFICACAO,
  VerificacaoEmailService,
} from './verificacao-email.service'

class VerificarEmailDto extends createZodDto(verificarEmailSchema) {}
class RespostaEnvioVerificacaoDto extends createZodDto(respostaEnvioVerificacaoSchema) {}
class RespostaVerificarEmailDto extends createZodDto(respostaVerificarEmailSchema) {}

const EXEMPLO_ENVIO: RespostaEnvioVerificacao = {
  enviadoPara: 'a***@gmail.com',
  expiraEm: '2026-10-02T12:00:00.000Z',
  proximoEnvioEm: '2026-10-01T12:01:00.000Z',
}

/** Só `@UsuarioAtual()`: o próprio usuário, sem 403/404 (convenções §9). */
@ApiTags('Autenticação')
@Controller('auth/verificar-email')
export class VerificacaoEmailController {
  constructor(private readonly verificacao: VerificacaoEmailService) {}

  @Post('enviar')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Envia um novo código de verificação para o e-mail do usuário',
    description:
      `Código de 6 dígitos válido por ${VALIDADE_CODIGO_VERIFICACAO_MS / HORA_MS} h; ` +
      'um novo envio invalida os anteriores.',
  })
  @ApiAcceptedResponse({ type: RespostaEnvioVerificacaoDto, example: EXEMPLO_ENVIO })
  @ApiConflictResponse({ description: '`EMAIL_JA_VERIFICADO`: nenhum e-mail é enviado.' })
  @ApiTooManyRequestsResponse({
    ...RESPOSTA_LIMITE_EXCEDIDO,
    description:
      `${LIMITE_ENVIOS_HORA.maximo} envios por hora (inclui o do cadastro) e ` +
      `${INTERVALO_ENVIO.janelaMs / 1000} s entre envios. ` +
      '`details: [{ field: "proximoEnvioEm", message: "<ISO>" }]`.',
  })
  enviar(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<RespostaEnvioVerificacao> {
    return this.verificacao.enviarCodigo(usuario)
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Confirma o e-mail com o código (idempotente)' })
  @ApiBody({ type: VerificarEmailDto, examples: { verificar: { value: { codigo: '482913' } } } })
  @ApiOkResponse({ type: RespostaVerificarEmailDto, example: { emailVerificado: true } })
  @ApiBadRequestResponse({
    description:
      '`VALIDATION_ERROR`; `CODIGO_INVALIDO` (errado ou substituído; cada erro conta uma ' +
      `tentativa) ou \`CODIGO_EXPIRADO\` (expirado, já usado, sem código ou após a ` +
      `${MAXIMO_TENTATIVAS_VERIFICACAO}ª tentativa errada): reenviar.`,
  })
  confirmar(
    @Body() dados: VerificarEmailDto,
    @UsuarioAtual('id') usuarioId: string,
  ): Promise<RespostaVerificarEmail> {
    return this.verificacao.confirmar(usuarioId, dados)
  }
}
