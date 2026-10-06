import {
  cancelarEventoSchema,
  criarEventoSchema,
  editarEventoSchema,
  eventoCanceladoDtoSchema,
  eventoDtoSchema,
  idParamSchema,
  Papel,
  type CriarEvento,
  type EventoCanceladoDto,
  type EventoDto,
} from '@atletica/shared'
import {
  Body,
  Controller,
  Delete,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { PapelMinimo } from '../auth/decorators/papel-minimo.decorator'
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator'
import type { UsuarioAutenticado } from '../auth/tipos'
import { EventosService } from './eventos.service'

/** União discriminada não é tipável como classe; o pipe valida pelo schema e devolve `CriarEvento`. */
const CriarEventoDtoBase: new () => object = createZodDto(criarEventoSchema)
class CriarEventoDto extends CriarEventoDtoBase {}
class EditarEventoDto extends createZodDto(editarEventoSchema) {}
class CancelarEventoDto extends createZodDto(cancelarEventoSchema) {}
class EventoIdDto extends createZodDto(idParamSchema) {}
class EventoRespostaDto extends createZodDto(eventoDtoSchema) {}
class EventoCanceladoRespostaDto extends createZodDto(eventoCanceladoDtoSchema) {}

const EXEMPLO: EventoDto = {
  id: '3c9a7b1e-5d2f-4e8a-9b6c-0d1e2f3a4b5c',
  tipo: 'JOGO',
  status: 'AGENDADO',
  inicio: '2026-10-10T22:00:00.000Z',
  local: 'Ginásio Castelinho',
  observacoes: 'Chegar 30 min antes',
  serieId: null,
  time: { id: '0b6f1f0e-2b7a-4d4e-9a65-1c2b3c4d5e6f', nome: 'Vôlei Masculino' },
  modalidade: { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', nome: 'Vôlei', icone: 'volleyball' },
  timeAdversario: {
    id: '7d1e2f3a-4b5c-4d6e-8f90-a1b2c3d4e5f6',
    nome: 'Vôlei Masculino',
    atletica: {
      id: 'e4f5a6b7-c8d9-4e0f-8a1b-2c3d4e5f6a7b',
      nome: 'Atlética Medicina',
      sigla: 'AAMED',
    },
  },
  placarTime: null,
  placarAdversario: null,
  resultado: null,
  criadoEm: '2026-09-30T14:00:00.000Z',
  atualizadoEm: '2026-09-30T14:00:00.000Z',
}

const NAO_AUTENTICADO = '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.'
const NAO_ENCONTRADO = '`NOT_FOUND`: evento inexistente, excluído ou de outra atlética.'
const INVALIDO =
  '`VALIDATION_ERROR`: corpo inválido, campo extra (ex.: `status`, placar), id não-UUID, ' +
  'Jogo sem adversário ou Treino com adversário.'
const TIMES_INVALIDOS =
  '`TIME_INVALIDO`, `TIME_INATIVO`, `MODALIDADE_INATIVA`, `ADVERSARIO_INVALIDO` ou ' +
  '`MODALIDADES_DIFERENTES`.'

@ApiTags('Eventos')
@ApiUnauthorizedResponse({ description: NAO_AUTENTICADO })
@ApiForbiddenResponse({ description: '`FORBIDDEN`: papel insuficiente.' })
@Controller('eventos')
export class EventosController {
  constructor(private readonly eventos: EventosService) {}

  @Post()
  @PapelMinimo(Papel.DIRETOR)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Cadastra um Jogo ou Treino avulso',
    description:
      'Nasce `AGENDADO`; a modalidade é a do time (RN10). Jogo exige adversário de outra ' +
      'atlética, ativo e da mesma modalidade (RN11); Treino não aceita adversário (RN12).',
  })
  @ApiBody({
    type: CriarEventoDto,
    examples: {
      jogo: {
        value: {
          tipo: 'JOGO',
          timeId: EXEMPLO.time.id,
          timeAdversarioId: EXEMPLO.timeAdversario?.id,
          inicio: EXEMPLO.inicio,
          local: EXEMPLO.local,
          observacoes: EXEMPLO.observacoes,
        },
      },
      treino: {
        value: { tipo: 'TREINO', timeId: EXEMPLO.time.id, inicio: EXEMPLO.inicio, local: 'Quadra' },
      },
    },
  })
  @ApiCreatedResponse({ type: EventoRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiUnprocessableEntityResponse({ description: TIMES_INVALIDOS })
  criar(
    @Body() dados: CriarEventoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<EventoDto> {
    return this.eventos.criar(dados as CriarEvento, usuario)
  }

  @Patch(':id')
  @PapelMinimo(Papel.DIRETOR)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Edita data, local, observações e times (ao menos um campo)',
    description:
      'Cancelado não é editável; Finalizado só aceita `observacoes`. Trocar `timeId` exige o ' +
      'evento sem participações. `timeAdversarioId` só em Jogo.',
  })
  @ApiOkResponse({ type: EventoRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: INVALIDO })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiConflictResponse({ description: '`EVENTO_COM_PARTICIPACOES` ao trocar o time.' })
  @ApiUnprocessableEntityResponse({
    description: `\`EVENTO_CANCELADO\`, \`EVENTO_FINALIZADO\`, ${TIMES_INVALIDOS}`,
  })
  atualizar(
    @Param() { id }: EventoIdDto,
    @Body() dados: EditarEventoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<EventoDto> {
    return this.eventos.atualizar(id, dados, usuario)
  }

  @Post(':id/cancelar')
  @PapelMinimo(Papel.DIRETOR)
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Cancela um evento Agendado ou Em andamento',
    description: 'O evento continua existindo com status `CANCELADO`. Corpo vazio.',
  })
  @ApiBody({ type: CancelarEventoDto, required: false })
  @ApiOkResponse({
    type: EventoCanceladoRespostaDto,
    example: { eventoIds: [EXEMPLO.id], status: 'CANCELADO' },
  })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não-UUID ou campo no corpo.' })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiUnprocessableEntityResponse({ description: '`EVENTO_FINALIZADO` ou `EVENTO_JA_CANCELADO`.' })
  cancelar(
    @Param() { id }: EventoIdDto,
    @Body() _corpo: CancelarEventoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<EventoCanceladoDto> {
    return this.eventos.cancelarPorId(id, usuario)
  }

  @Delete(':id')
  @PapelMinimo(Papel.PRESIDENTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Exclui (logicamente) um evento sem participações nem resultado',
    description: 'Com respostas, presenças ou resultado, o evento só pode ser cancelado (RN26).',
  })
  @ApiNoContentResponse({ description: 'Excluído.' })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não-UUID.' })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiConflictResponse({
    description: '`EVENTO_COM_DEPENDENCIAS`, com `details` em `participacoes` e/ou `resultado`.',
  })
  excluir(@Param() { id }: EventoIdDto): Promise<void> {
    return this.eventos.excluir(id)
  }
}
