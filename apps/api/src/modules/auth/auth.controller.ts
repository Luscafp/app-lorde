import {
  cadastroSchema,
  esqueciSenhaSchema,
  loginSchema,
  MENSAGEM_RECUPERACAO_ENVIADA,
  redefinirSenhaSchema,
  refreshTokenSchema,
  respostaEsqueciSenhaSchema,
  respostaSessaoSchema,
  respostaVerificarCodigoSchema,
  TERMOS_VERSAO,
  VALIDADE_CODIGO_MS,
  verificarCodigoSchema,
  type RespostaEsqueciSenha,
  type RespostaSessao,
  type RespostaVerificarCodigo,
} from '@atletica/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { createZodDto } from 'nestjs-zod'
import { RESPOSTA_LIMITE_EXCEDIDO } from '../../common/swagger/respostas'
import { emMinutos } from '../../common/tempo'
import { AuthService, LIMITE_CADASTRO, LIMITE_LOGIN, type OrigemRequisicao } from './auth.service'
import { Publico } from './decorators/publico.decorator'
import {
  LIMITE_CODIGO_IP,
  LIMITE_ENVIO_EMAIL,
  LIMITE_ENVIO_IP,
  MAXIMO_TENTATIVAS_CODIGO,
  RecuperacaoSenhaService,
} from './recuperacao-senha.service'
import { JANELA_CONCORRENCIA_MS } from './sessao.service'

class CadastroDto extends createZodDto(cadastroSchema) {}
class LoginDto extends createZodDto(loginSchema) {}
class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
class RespostaSessaoDto extends createZodDto(respostaSessaoSchema) {}
class EsqueciSenhaDto extends createZodDto(esqueciSenhaSchema) {}
class VerificarCodigoDto extends createZodDto(verificarCodigoSchema) {}
class RedefinirSenhaDto extends createZodDto(redefinirSenhaSchema) {}
class RespostaEsqueciSenhaDto extends createZodDto(respostaEsqueciSenhaSchema) {}
class RespostaVerificarCodigoDto extends createZodDto(respostaVerificarCodigoSchema) {}

const EXEMPLO_CADASTRO = {
  nome: 'Ana Souza',
  email: 'ana@exemplo.com',
  senha: 'lorde2026',
  aceiteTermos: true,
  versaoTermos: TERMOS_VERSAO,
}

const EXEMPLO_LOGIN = { email: 'ana@exemplo.com', senha: 'lorde2026' }

const EXEMPLO_RESPOSTA: RespostaSessao = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  refreshToken: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11.Q2x0b2tlbi1zZWNyZXQtZXhlbXBsby0zMmJ5dGVz',
  accessTokenExpiraEm: '2026-10-01T22:15:00.000Z',
  usuario: {
    id: '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90',
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    fotoUrl: null,
    papel: 'ATLETA',
    atleticaId: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
  },
}

const EXEMPLO_REFRESH = { refreshToken: EXEMPLO_RESPOSTA.refreshToken }

const EXEMPLO_ESQUECI = { email: 'ana@exemplo.com' }
const EXEMPLO_VERIFICAR = { ...EXEMPLO_ESQUECI, codigo: '048213' }
const EXEMPLO_REDEFINIR = { ...EXEMPLO_VERIFICAR, novaSenha: 'novaSenha9' }

const DESCRICAO_CODIGO_INVALIDO =
  '`CODIGO_INVALIDO`: errado, expirado, já usado, substituído por um mais novo ou e-mail sem ' +
  `código. Cada erro conta uma tentativa; na ${MAXIMO_TENTATIVAS_CODIGO}ª o código é invalidado.`

function origem(req: Request): OrigemRequisicao {
  return { ip: req.ip, userAgent: req.get('user-agent') }
}

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly recuperacao: RecuperacaoSenhaService,
  ) {}

  /** Pública: cria a conta (RF02, UC06) e já autentica. */
  @Publico()
  @Post('cadastro')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Cadastro com auto-login (papel ATLETA na atlética padrão)' })
  @ApiBody({ type: CadastroDto, examples: { cadastro: { value: EXEMPLO_CADASTRO } } })
  @ApiCreatedResponse({ type: RespostaSessaoDto, example: EXEMPLO_RESPOSTA })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR` (inclui campo desconhecido).' })
  @ApiConflictResponse({ description: '`EMAIL_JA_CADASTRADO` ou `TERMOS_DESATUALIZADOS`.' })
  @ApiTooManyRequestsResponse({
    ...RESPOSTA_LIMITE_EXCEDIDO,
    description: `Mais de ${LIMITE_CADASTRO.maximo} cadastros por IP em ${emMinutos(LIMITE_CADASTRO.janelaMs)} min.`,
  })
  cadastrar(@Body() dados: CadastroDto, @Req() req: Request): Promise<RespostaSessao> {
    return this.auth.cadastrar(dados, origem(req))
  }

  /** Pública: login por e-mail e senha (RF01, UC07). */
  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Login por e-mail e senha' })
  @ApiBody({ type: LoginDto, examples: { login: { value: EXEMPLO_LOGIN } } })
  @ApiOkResponse({ type: RespostaSessaoDto, example: EXEMPLO_RESPOSTA })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`.' })
  @ApiUnauthorizedResponse({
    description:
      '`CREDENCIAIS_INVALIDAS` (e-mail inexistente ou senha errada) ou `CONTA_DESATIVADA` ' +
      '(só com a senha correta).',
  })
  @ApiTooManyRequestsResponse({
    ...RESPOSTA_LIMITE_EXCEDIDO,
    description:
      `${LIMITE_LOGIN.maximo} falhas em ${emMinutos(LIMITE_LOGIN.janelaMs)} min para o mesmo e-mail + IP; ` +
      `bloqueio de ${emMinutos(LIMITE_LOGIN.bloqueioMs ?? 0)} min.`,
  })
  entrar(@Body() dados: LoginDto, @Req() req: Request): Promise<RespostaSessao> {
    return this.auth.entrar(dados, origem(req))
  }

  /** Pública: o access token pode já ter expirado. Rotaciona o refresh token a cada uso. */
  @Publico()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Renova a sessão e rotaciona o refresh token' })
  @ApiBody({ type: RefreshTokenDto, examples: { refresh: { value: EXEMPLO_REFRESH } } })
  @ApiOkResponse({ type: RespostaSessaoDto, example: EXEMPLO_RESPOSTA })
  @ApiBadRequestResponse({
    description: '`VALIDATION_ERROR` (corpo sem `refreshToken` ou com campo desconhecido).',
  })
  @ApiUnauthorizedResponse({
    description:
      '`REFRESH_INVALIDO` (formato, sessão inexistente ou expirada), `SESSAO_REVOGADA` ' +
      '(revogada ou reuso de token já rotacionado), `REFRESH_JA_ROTACIONADO` (token anterior ' +
      `reapresentado em menos de ${JANELA_CONCORRENCIA_MS / 1000} s; a sessão continua ativa) ou ` +
      '`CONTA_DESATIVADA`. O app encerra a sessão em qualquer 401.',
  })
  renovar(@Body() { refreshToken }: RefreshTokenDto): Promise<RespostaSessao> {
    return this.auth.renovar(refreshToken)
  }

  /** Pública e idempotente (UC08 A1): funciona com access token expirado e sem conexão prévia. */
  @Publico()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Encerra a sessão do refresh token (atual ou anterior)' })
  @ApiBody({ type: RefreshTokenDto, examples: { logout: { value: EXEMPLO_REFRESH } } })
  @ApiNoContentResponse({
    description: 'Sempre, inclusive com token malformado, expirado ou de sessão já revogada.',
  })
  @ApiBadRequestResponse({
    description: '`VALIDATION_ERROR` (corpo sem `refreshToken` ou com campo desconhecido).',
  })
  sair(@Body() { refreshToken }: RefreshTokenDto): Promise<void> {
    return this.auth.sair(refreshToken)
  }

  /** Pública (UC09): resposta, status e tempo iguais exista ou não o e-mail. */
  @Publico()
  @Post('senha/esqueci')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Envia um código de recuperação de senha para o e-mail' })
  @ApiBody({ type: EsqueciSenhaDto, examples: { esqueci: { value: EXEMPLO_ESQUECI } } })
  @ApiAcceptedResponse({
    type: RespostaEsqueciSenhaDto,
    example: { message: MENSAGEM_RECUPERACAO_ENVIADA },
    description:
      `Sempre a mesma mensagem. Só contas ativas recebem o código (6 dígitos, válido por ` +
      `${emMinutos(VALIDADE_CODIGO_MS)} min); um código novo invalida os anteriores.`,
  })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR` (formato do e-mail).' })
  @ApiTooManyRequestsResponse({
    ...RESPOSTA_LIMITE_EXCEDIDO,
    description:
      `${LIMITE_ENVIO_EMAIL.maximo} pedidos por e-mail em ${emMinutos(LIMITE_ENVIO_EMAIL.janelaMs)} min ` +
      `(cadastrado ou não) ou ${LIMITE_ENVIO_IP.maximo} por IP.`,
  })
  esquecerSenha(
    @Body() dados: EsqueciSenhaDto,
    @Req() req: Request,
  ): Promise<RespostaEsqueciSenha> {
    return this.recuperacao.solicitar(dados, origem(req))
  }

  /** Pública: confere o código sem consumi-lo, antes da tela de nova senha. */
  @Publico()
  @Post('senha/verificar-codigo')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Confere o código de recuperação sem consumi-lo' })
  @ApiBody({ type: VerificarCodigoDto, examples: { verificar: { value: EXEMPLO_VERIFICAR } } })
  @ApiOkResponse({ type: RespostaVerificarCodigoDto, example: { valido: true } })
  @ApiBadRequestResponse({ description: `\`VALIDATION_ERROR\` ou ${DESCRICAO_CODIGO_INVALIDO}` })
  @ApiTooManyRequestsResponse({
    ...RESPOSTA_LIMITE_EXCEDIDO,
    description: `${LIMITE_CODIGO_IP.maximo} códigos errados por IP em ${emMinutos(LIMITE_CODIGO_IP.janelaMs)} min.`,
  })
  verificarCodigo(
    @Body() dados: VerificarCodigoDto,
    @Req() req: Request,
  ): Promise<RespostaVerificarCodigo> {
    return this.recuperacao.verificarCodigo(dados, origem(req))
  }

  /** Pública: consome o código, troca a senha e encerra todas as sessões. Sem auto-login. */
  @Publico()
  @Post('senha/redefinir')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Redefine a senha com o código e encerra todas as sessões' })
  @ApiBody({ type: RedefinirSenhaDto, examples: { redefinir: { value: EXEMPLO_REDEFINIR } } })
  @ApiNoContentResponse({
    description: 'Senha trocada; todas as sessões revogadas e falhas de login do e-mail apagadas.',
  })
  @ApiBadRequestResponse({
    description: `\`VALIDATION_ERROR\` (senha fraca não gasta tentativa do código) ou ${DESCRICAO_CODIGO_INVALIDO}`,
  })
  @ApiTooManyRequestsResponse({
    ...RESPOSTA_LIMITE_EXCEDIDO,
    description: `${LIMITE_CODIGO_IP.maximo} códigos errados por IP em ${emMinutos(LIMITE_CODIGO_IP.janelaMs)} min.`,
  })
  redefinirSenha(@Body() dados: RedefinirSenhaDto, @Req() req: Request): Promise<void> {
    return this.recuperacao.redefinir(dados, origem(req))
  }
}
