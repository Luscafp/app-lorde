import {
  cadastroSchema,
  loginSchema,
  respostaSessaoSchema,
  TERMOS_VERSAO,
  type RespostaSessao,
} from '@atletica/shared'
import { Body, Controller, Header, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { createZodDto } from 'nestjs-zod'
import { AuthService, LIMITE_CADASTRO, LIMITE_LOGIN, type OrigemRequisicao } from './auth.service'
import { Publico } from './decorators/publico.decorator'

class CadastroDto extends createZodDto(cadastroSchema) {}
class LoginDto extends createZodDto(loginSchema) {}
class RespostaSessaoDto extends createZodDto(respostaSessaoSchema) {}

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

const LIMITE_EXCEDIDO = {
  description: '`RATE_LIMITED`: aguarde os segundos do cabeçalho `Retry-After`.',
  headers: { 'Retry-After': { description: 'Segundos até a próxima tentativa.' } },
}

const MINUTO_MS = 60_000
const minutos = (ms: number) => ms / MINUTO_MS

function origem(req: Request): OrigemRequisicao {
  return { ip: req.ip, userAgent: req.get('user-agent') }
}

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
    ...LIMITE_EXCEDIDO,
    description: `Mais de ${LIMITE_CADASTRO.maximo} cadastros por IP em ${minutos(LIMITE_CADASTRO.janelaMs)} min.`,
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
    ...LIMITE_EXCEDIDO,
    description:
      `${LIMITE_LOGIN.maximo} falhas em ${minutos(LIMITE_LOGIN.janelaMs)} min para o mesmo e-mail + IP; ` +
      `bloqueio de ${minutos(LIMITE_LOGIN.bloqueioMs ?? 0)} min.`,
  })
  entrar(@Body() dados: LoginDto, @Req() req: Request): Promise<RespostaSessao> {
    return this.auth.entrar(dados, origem(req))
  }
}
