import {
  idParamSchema,
  participacaoRespondidaDtoSchema,
  responderParticipacaoSchema,
  type ParticipacaoRespondidaDto,
} from '@atletica/shared'
import { Body, Controller, Header, Param, Put } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
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
import { ParticipacoesService } from './participacoes.service'

class EventoIdDto extends createZodDto(idParamSchema) {}
class ResponderParticipacaoDto extends createZodDto(responderParticipacaoSchema) {}
class ParticipacaoRespondidaRespostaDto extends createZodDto(participacaoRespondidaDtoSchema) {}

const EXEMPLO: ParticipacaoRespondidaDto = {
  eventoId: '3c9a7b1e-5d2f-4e8a-9b6c-0d1e2f3a4b5c',
  confirmado: true,
  respondidoEm: '2026-10-08T14:32:10.000Z',
  contagem: { confirmados: 9, recusados: 2, semResposta: 3, elenco: 14 },
}

@ApiTags('Eventos')
@ApiUnauthorizedResponse({ description: '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.' })
@Controller('eventos')
export class ParticipacoesController {
  constructor(private readonly participacoes: ParticipacoesService) {}

  @Put(':id/participacao')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Confirma ou recusa a participação no evento (membro do elenco)',
    description:
      'Vale para qualquer papel, desde que o usuário do token esteja no elenco atual do time ' +
      '(RN30). Só com o evento `AGENDADO` e antes do início, pelo relógio do servidor. A nova ' +
      'resposta substitui a anterior; a mesma resposta responde 200 sem alterar `respondidoEm`. ' +
      '`contagem` considera só o elenco atual.',
  })
  @ApiBody({
    type: ResponderParticipacaoDto,
    examples: { vou: { value: { confirmado: true } }, naoVou: { value: { confirmado: false } } },
  })
  @ApiOkResponse({ type: ParticipacaoRespondidaRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({
    description:
      '`VALIDATION_ERROR`: id não-UUID, `confirmado` ausente ou não booleano, campo extra.',
  })
  @ApiForbiddenResponse({ description: '`NAO_MEMBRO_DO_ELENCO`.' })
  @ApiNotFoundResponse({
    description: '`NOT_FOUND`: evento inexistente, excluído ou de outra atlética.',
  })
  @ApiUnprocessableEntityResponse({
    description: '`EVENTO_CANCELADO`, `EVENTO_NAO_AGENDADO` ou `EVENTO_JA_INICIADO`.',
  })
  responder(
    @Param() { id }: EventoIdDto,
    @Body() { confirmado }: ResponderParticipacaoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<ParticipacaoRespondidaDto> {
    return this.participacoes.responder(id, confirmado, usuario)
  }
}
