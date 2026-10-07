import {
  solicitacaoDtoSchema,
  solicitacaoIdSchema,
  timeIdSchema,
  type SolicitacaoDto,
} from '@atletica/shared'
import { Controller, Header, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator'
import type { UsuarioAutenticado } from '../auth/tipos'
import { SolicitacoesService } from './solicitacoes.service'

class TimeIdDto extends createZodDto(timeIdSchema) {}
class SolicitacaoIdDto extends createZodDto(solicitacaoIdSchema) {}
class SolicitacaoRespostaDto extends createZodDto(solicitacaoDtoSchema) {}

const EXEMPLO: SolicitacaoDto = {
  id: 'd4c3b2a1-6f5e-4b7a-9c8d-1e0f2a3b4c5d',
  timeId: 'b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  status: 'PENDENTE',
  criadaEm: '2026-09-30T14:00:00.000Z',
  canceladaEm: null,
}

const NAO_AUTENTICADO = '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.'
const ID_INVALIDO = '`VALIDATION_ERROR`: id não-UUID.'

@ApiTags('Solicitações')
@ApiUnauthorizedResponse({ description: NAO_AUTENTICADO })
@Controller()
export class SolicitacoesController {
  constructor(private readonly solicitacoes: SolicitacoesService) {}

  @Post('times/:id/solicitacoes')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Solicita entrada no time (qualquer papel)',
    description:
      'Sem corpo; o solicitante é sempre o usuário do token. Emite `solicitacao.criada` após o commit.',
  })
  @ApiCreatedResponse({ type: SolicitacaoRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: ID_INVALIDO })
  @ApiNotFoundResponse({
    description: '`NOT_FOUND`: time inexistente ou de outra atlética que usa o aplicativo.',
  })
  @ApiConflictResponse({
    description: '`JA_E_MEMBRO` ou `SOLICITACAO_PENDENTE` (já há uma pendente para o time).',
  })
  @ApiUnprocessableEntityResponse({ description: '`TIME_ADVERSARIO` ou `TIME_INATIVO`.' })
  criar(
    @Param() { id }: TimeIdDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<SolicitacaoDto> {
    return this.solicitacoes.criar(id, usuario)
  }

  @Post('solicitacoes/:id/cancelar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Cancela a própria solicitação pendente',
    description: 'Já cancelada responde 200 com o estado atual, sem nova gravação.',
  })
  @ApiOkResponse({
    type: SolicitacaoRespostaDto,
    example: { ...EXEMPLO, status: 'CANCELADA', canceladaEm: '2026-09-30T15:00:00.000Z' },
  })
  @ApiBadRequestResponse({ description: ID_INVALIDO })
  @ApiNotFoundResponse({
    description: '`NOT_FOUND`: solicitação inexistente, de outra atlética ou de outro usuário.',
  })
  @ApiConflictResponse({ description: '`SOLICITACAO_JA_AVALIADA`: aprovada ou rejeitada.' })
  cancelar(
    @Param() { id }: SolicitacaoIdDto,
    @UsuarioAtual('id') usuarioId: string,
  ): Promise<SolicitacaoDto> {
    return this.solicitacoes.cancelar(id, usuarioId)
  }
}
