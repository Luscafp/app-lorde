import {
  alterarStatusSchema,
  cancelarEventoSchema,
  criarEventoOuSerieSchema,
  criarEventoSchema,
  criarSerieSchema,
  editarEventoSchema,
  editarOcorrenciaSchema,
  editarSeguintesSchema,
  EscopoOcorrencia,
  eventoCanceladoDtoSchema,
  eventoDetalheSchema,
  eventoDtoSchema,
  idParamSchema,
  listaEventosSchema,
  listarEventosQuerySchema,
  ocorrenciasAlteradasDtoSchema,
  Papel,
  registrarResultadoSchema,
  serieCriadaDtoSchema,
  statusEventoAlteradoDtoSchema,
  type CriarEvento,
  type CriarSerie,
  type EditarEvento,
  type EditarSeguintes,
  type EventoCanceladoDto,
  type EventoDetalheDto,
  type EventoDto,
  type ListaEventos,
  type OcorrenciasAlteradasDto,
  type SerieCriadaDto,
  type StatusEventoAlteradoDto,
} from '@atletica/shared'
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { PapelMinimo } from '../auth/decorators/papel-minimo.decorator'
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator'
import type { UsuarioAutenticado } from '../auth/tipos'
import { EventosLeituraService } from './eventos-leitura.service'
import { EventosStatusService } from './eventos-status.service'
import { EventosService } from './eventos.service'
import { paraEventoResumo } from './linha-evento'
import { ResultadoService } from './resultado.service'
import { SeriesRecorrenciaService } from './series-recorrencia.service'

/** União não é tipável como classe; o pipe valida pelo schema e devolve `CriarEvento | CriarSerie`. */
const CriarEventoDtoBase: new () => object = createZodDto(criarEventoOuSerieSchema)
class CriarEventoDto extends CriarEventoDtoBase {}
const EditarEventoDtoBase: new () => object = createZodDto(editarOcorrenciaSchema)
class EditarEventoDto extends EditarEventoDtoBase {}
/** Só documentação: as variantes de cada corpo. */
const EventoAvulsoDtoBase: new () => object = createZodDto(criarEventoSchema)
class EventoAvulsoDto extends EventoAvulsoDtoBase {}
class TreinoRecorrenteDto extends createZodDto(criarSerieSchema) {}
class EditarEstaDto extends createZodDto(editarEventoSchema) {}
class EditarSeguintesDto extends createZodDto(editarSeguintesSchema) {}
class SerieCriadaRespostaDto extends createZodDto(serieCriadaDtoSchema) {}
class OcorrenciasAlteradasRespostaDto extends createZodDto(ocorrenciasAlteradasDtoSchema) {}
class CancelarEventoDto extends createZodDto(cancelarEventoSchema) {}
class EventoIdDto extends createZodDto(idParamSchema) {}
class EventoRespostaDto extends createZodDto(eventoDtoSchema) {}
class EventoCanceladoRespostaDto extends createZodDto(eventoCanceladoDtoSchema) {}
class ListarEventosQueryDto extends createZodDto(listarEventosQuerySchema) {}
class ListaEventosDto extends createZodDto(listaEventosSchema) {}
class EventoDetalheRespostaDto extends createZodDto(eventoDetalheSchema) {}
class AlterarStatusDto extends createZodDto(alterarStatusSchema) {}
class StatusAlteradoRespostaDto extends createZodDto(statusEventoAlteradoDtoSchema) {}
class ResultadoDto extends createZodDto(registrarResultadoSchema) {}

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

const EXEMPLO_LISTA: ListaEventos = {
  items: [
    {
      ...paraEventoResumo(EXEMPLO),
      souMembro: true,
      minhaParticipacao: { confirmado: true, respondidoEm: '2026-10-01T12:00:00.000Z' },
    },
  ],
  page: 1,
  limit: 20,
  total: 45,
}

const EXEMPLO_DETALHE: EventoDetalheDto = {
  ...EXEMPLO,
  serie: null,
  contagem: { confirmados: 8, recusados: 2, semResposta: 4, elenco: 14 },
  confirmados: [
    {
      id: 'c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f',
      nome: 'Ana Souza',
      fotoUrl: 'https://img.exemplo.com/usuarios/c2d3e4f5/perfil/foto.jpg',
      capitao: true,
    },
  ],
  souMembro: true,
  minhaParticipacao: { confirmado: true, respondidoEm: '2026-10-01T12:00:00.000Z' },
  podeResponder: true,
  motivoBloqueioResposta: null,
}

const EXEMPLO_SERIE: SerieCriadaDto = {
  serie: {
    id: '5f2c8d1e-3a4b-4c5d-8e6f-7a8b9c0d1e2f',
    timeId: EXEMPLO.time.id,
    diasSemana: [1, 3],
    horario: '18:30',
    dataInicio: '2026-10-05',
    dataFim: '2027-04-05',
  },
  totalOcorrencias: 53,
  primeiraOcorrencia: {
    id: '9a01b2c3-d4e5-4f60-8a1b-2c3d4e5f6a7b',
    inicio: '2026-10-05T21:30:00.000Z',
  },
  ultimaOcorrencia: {
    id: 'e7b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    inicio: '2027-04-05T21:30:00.000Z',
  },
}

const ehSerie = (dados: CriarEvento | CriarSerie): dados is CriarSerie => 'recorrencia' in dados

const ehSeguintes = (dados: EditarEvento | EditarSeguintes): dados is EditarSeguintes =>
  dados.escopo === EscopoOcorrencia.ESTA_E_SEGUINTES

const NAO_AUTENTICADO = '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.'
const SEM_PERMISSAO = '`FORBIDDEN`: papel insuficiente.'
const NAO_ENCONTRADO = '`NOT_FOUND`: evento inexistente, excluído ou de outra atlética.'
const INVALIDO =
  '`VALIDATION_ERROR`: corpo inválido, campo extra (ex.: `status`, placar), id não-UUID, ' +
  'Jogo sem adversário ou Treino com adversário.'
const TIMES_INVALIDOS =
  '`TIME_INVALIDO`, `TIME_INATIVO`, `MODALIDADE_INATIVA`, `ADVERSARIO_INVALIDO` ou ' +
  '`MODALIDADES_DIFERENTES`.'

@ApiTags('Eventos')
@ApiExtraModels(
  EventoAvulsoDto,
  TreinoRecorrenteDto,
  EditarEstaDto,
  EditarSeguintesDto,
  EventoRespostaDto,
  SerieCriadaRespostaDto,
  OcorrenciasAlteradasRespostaDto,
)
@ApiUnauthorizedResponse({ description: NAO_AUTENTICADO })
@Controller('eventos')
export class EventosController {
  constructor(
    private readonly eventos: EventosService,
    private readonly eventosStatus: EventosStatusService,
    private readonly resultados: ResultadoService,
    private readonly leitura: EventosLeituraService,
    private readonly series: SeriesRecorrenciaService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Lista jogos e treinos com filtros e paginação (qualquer papel)',
    description:
      '`periodo`: `PROXIMOS` (padrão) = em andamento, ou agendado/cancelado a partir de 00:00 de ' +
      'hoje em America/Fortaleza (RN18); `PASSADOS` = o restante; `TODOS`. Ordem padrão: ' +
      '`inicio` crescente em `PROXIMOS`, decrescente nos demais. `modalidadeId` filtra pela ' +
      'modalidade do time (RN19). `status` aceita lista separada por vírgula. `resultado` ' +
      'restringe a jogos `FINALIZADO`. `confirmadoPorMim` usa o usuário do token. Eventos de ' +
      'time ou modalidade inativos só aparecem com `incluirInativos=true` para DIRETOR ou acima.',
  })
  @ApiOkResponse({ type: ListaEventosDto, example: EXEMPLO_LISTA })
  @ApiBadRequestResponse({
    description: '`VALIDATION_ERROR`: parâmetro inválido ou desconhecido, `limit` fora de 1–50.',
  })
  listar(
    @Query() query: ListarEventosQueryDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<ListaEventos> {
    return this.leitura.listar(query, usuario)
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Detalhe do evento com contagem do elenco atual e a participação do usuário',
    description:
      '`contagem` e `confirmados` ("Quem vai") consideram só o elenco atual do time. ' +
      '`podeResponder` (RN30) e `motivoBloqueioResposta` (`NAO_MEMBRO_DO_ELENCO`, ' +
      '`EVENTO_CANCELADO`, `EVENTO_NAO_AGENDADO`, `EVENTO_JA_INICIADO`) usam o relógio do servidor.',
  })
  @ApiOkResponse({ type: EventoDetalheRespostaDto, example: EXEMPLO_DETALHE })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não-UUID.' })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  detalhar(
    @Param() { id }: EventoIdDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<EventoDetalheDto> {
    return this.leitura.detalhar(id, usuario)
  }

  @Post()
  @PapelMinimo(Papel.DIRETOR)
  @ApiForbiddenResponse({ description: SEM_PERMISSAO })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Cadastra um Jogo, um Treino avulso ou um Treino recorrente',
    description:
      'Nasce `AGENDADO`; a modalidade é a do time (RN10). Jogo exige adversário de outra ' +
      'atlética, ativo e da mesma modalidade (RN11); Treino não aceita adversário (RN12). ' +
      'Treino com `recorrencia` (no lugar de `inicio`) gera, na mesma transação, uma ocorrência ' +
      'por data entre `dataInicio` e `dataFim` (até 6 meses) nos `diasSemana` (0 = domingo), ' +
      'no `horario` de America/Fortaleza, omitindo as já iniciadas (RN13). Geração síncrona, ' +
      'sem fila; emite um único `evento.criado` para a série.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(EventoAvulsoDto) },
        { $ref: getSchemaPath(TreinoRecorrenteDto) },
      ],
    },
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
      treinoRecorrente: {
        value: {
          tipo: 'TREINO',
          timeId: EXEMPLO.time.id,
          local: 'Quadra do CCET',
          observacoes: null,
          recorrencia: {
            dataInicio: '2026-10-05',
            horario: '18:30',
            diasSemana: [1, 3],
            dataFim: '2027-04-05',
          },
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'O evento criado ou, com `recorrencia`, o resumo da série.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(EventoRespostaDto) },
        { $ref: getSchemaPath(SerieCriadaRespostaDto) },
      ],
    },
    examples: {
      avulso: { summary: 'Avulso', value: EXEMPLO },
      recorrente: { summary: 'Treino recorrente', value: EXEMPLO_SERIE },
    },
  })
  @ApiBadRequestResponse({
    description:
      `${INVALIDO} Na recorrência: \`inicio\` junto, Jogo, dias inválidos ou repetidos, ` +
      'horário inválido, início no passado ou período acima de 6 meses.',
  })
  @ApiUnprocessableEntityResponse({
    description: `${TIMES_INVALIDOS} \`SERIE_SEM_OCORRENCIAS\`: nenhuma data gerada.`,
  })
  criar(
    @Body() corpo: CriarEventoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<EventoDto | SerieCriadaDto> {
    const dados = corpo as CriarEvento | CriarSerie
    return ehSerie(dados) ? this.series.criar(dados, usuario) : this.eventos.criar(dados, usuario)
  }

  @Patch(':id')
  @PapelMinimo(Papel.DIRETOR)
  @ApiForbiddenResponse({ description: SEM_PERMISSAO })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Edita data, local, observações e times (ao menos um campo)',
    description:
      'Cancelado não é editável; Finalizado só aceita `observacoes`. Trocar `timeId` exige o ' +
      'evento sem participações. `timeAdversarioId` só em Jogo. Em ocorrência de série, ' +
      '`escopo: ESTA_E_SEGUINTES` aceita só `horario`, `local` e `observacoes` e os aplica à ' +
      'ocorrência e às seguintes `AGENDADO`, cada uma no seu dia; mudar o horário a partir de ' +
      'uma ocorrência que não é a 1ª divide a série.',
  })
  @ApiBody({
    schema: {
      oneOf: [{ $ref: getSchemaPath(EditarEstaDto) }, { $ref: getSchemaPath(EditarSeguintesDto) }],
    },
    examples: {
      esta: { value: { local: 'Quadra 2' } },
      estaESeguintes: {
        value: { escopo: 'ESTA_E_SEGUINTES', horario: '19:00', local: 'Quadra 2' },
      },
    },
  })
  @ApiOkResponse({
    description: 'O evento editado ou, com `ESTA_E_SEGUINTES`, as ocorrências alteradas.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(EventoRespostaDto) },
        { $ref: getSchemaPath(OcorrenciasAlteradasRespostaDto) },
      ],
    },
    examples: {
      esta: { summary: 'Só esta', value: EXEMPLO },
      estaESeguintes: {
        summary: 'Esta e as seguintes',
        value: {
          eventoIds: [EXEMPLO_SERIE.primeiraOcorrencia.id],
          serieId: '8c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
          serieDividida: true,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: `${INVALIDO} Com \`ESTA_E_SEGUINTES\`: \`inicio\` ou \`timeId\` no corpo.`,
  })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiConflictResponse({ description: '`EVENTO_COM_PARTICIPACOES` ao trocar o time.' })
  @ApiUnprocessableEntityResponse({
    description:
      `\`EVENTO_CANCELADO\`, \`EVENTO_FINALIZADO\`, ${TIMES_INVALIDOS} ` +
      '`EVENTO_SEM_SERIE`: `ESTA_E_SEGUINTES` em evento avulso.',
  })
  atualizar(
    @Param() { id }: EventoIdDto,
    @Body() corpo: EditarEventoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<EventoDto | OcorrenciasAlteradasDto> {
    const dados = corpo as EditarEvento | EditarSeguintes
    return ehSeguintes(dados)
      ? this.series.editarSeguintes(id, dados, usuario)
      : this.eventos.atualizar(id, dados, usuario)
  }

  @Post(':id/cancelar')
  @PapelMinimo(Papel.DIRETOR)
  @ApiForbiddenResponse({ description: SEM_PERMISSAO })
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Cancela um evento Agendado ou Em andamento',
    description:
      'O evento continua existindo com status `CANCELADO`. Corpo opcional. Em ocorrência de ' +
      'série, `escopo: ESTA_E_SEGUINTES` cancela também as seguintes `AGENDADO`; sem nenhuma ' +
      'agendada restante, a série fica cancelada.',
  })
  @ApiBody({
    type: CancelarEventoDto,
    required: false,
    examples: { esta: { value: {} }, estaESeguintes: { value: { escopo: 'ESTA_E_SEGUINTES' } } },
  })
  @ApiOkResponse({
    type: EventoCanceladoRespostaDto,
    example: { eventoIds: [EXEMPLO.id], status: 'CANCELADO' },
  })
  @ApiBadRequestResponse({
    description: '`VALIDATION_ERROR`: id não-UUID, escopo inválido ou outro campo no corpo.',
  })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiUnprocessableEntityResponse({
    description: '`EVENTO_FINALIZADO`, `EVENTO_JA_CANCELADO` ou `EVENTO_SEM_SERIE`.',
  })
  cancelar(
    @Param() { id }: EventoIdDto,
    @Body() { escopo }: CancelarEventoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<EventoCanceladoDto> {
    return escopo === EscopoOcorrencia.ESTA_E_SEGUINTES
      ? this.series.cancelarSeguintes(id, usuario)
      : this.eventos.cancelarPorId(id, usuario)
  }

  @Patch(':id/status')
  @PapelMinimo(Papel.DIRETOR)
  @ApiForbiddenResponse({ description: SEM_PERMISSAO })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Altera o status pela máquina de estados',
    description:
      'Mesmo status: 200 sem alteração. `EM_ANDAMENTO → AGENDADO` exige o evento sem presença; ' +
      '`FINALIZADO → EM_ANDAMENTO` exige o jogo sem resultado; `CANCELADO` é terminal. ' +
      'Destino `CANCELADO` executa o cancelamento de `POST /eventos/:id/cancelar`.',
  })
  @ApiBody({ type: AlterarStatusDto, examples: { finalizar: { value: { status: 'FINALIZADO' } } } })
  @ApiOkResponse({
    type: StatusAlteradoRespostaDto,
    example: { id: EXEMPLO.id, status: 'FINALIZADO', statusAnterior: 'EM_ANDAMENTO' },
  })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: status desconhecido ou campo extra.' })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiConflictResponse({ description: '`CONFLITO_STATUS`: o status mudou desde a leitura.' })
  @ApiUnprocessableEntityResponse({
    description: '`TRANSICAO_INVALIDA`, com `details` em `status` no formato `DE → PARA`.',
  })
  alterarStatus(
    @Param() { id }: EventoIdDto,
    @Body() { status }: AlterarStatusDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<StatusEventoAlteradoDto> {
    return this.eventosStatus.alterar(id, status, usuario)
  }

  @Put(':id/resultado')
  @PapelMinimo(Papel.DIRETOR)
  @ApiForbiddenResponse({ description: SEM_PERMISSAO })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Registra ou corrige o placar de um jogo',
    description:
      'O `resultado` é calculado no servidor (RN17). O jogo precisa estar `FINALIZADO`, ou ' +
      '`finalizar: true` o finaliza na mesma transação (UC17 A1). Mesmo placar: 200 sem alteração.',
  })
  @ApiBody({
    type: ResultadoDto,
    examples: {
      registrar: { value: { placarTime: 3, placarAdversario: 1 } },
      finalizarERegistrar: { value: { placarTime: 3, placarAdversario: 1, finalizar: true } },
    },
  })
  @ApiOkResponse({
    type: EventoRespostaDto,
    example: {
      ...EXEMPLO,
      status: 'FINALIZADO',
      placarTime: 3,
      placarAdversario: 1,
      resultado: 'VITORIA',
    },
  })
  @ApiBadRequestResponse({
    description: '`VALIDATION_ERROR`: placar fora de 0–999, não inteiro, ausente ou campo extra.',
  })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiConflictResponse({
    description:
      '`CONFLITO_STATUS`: o status mudou desde a leitura; `CONFLITO_CONCORRENTE`: o placar mudou.',
  })
  @ApiUnprocessableEntityResponse({
    description: '`EVENTO_NAO_E_JOGO`, `EVENTO_CANCELADO` ou `EVENTO_NAO_FINALIZADO`.',
  })
  registrarResultado(
    @Param() { id }: EventoIdDto,
    @Body() dados: ResultadoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<EventoDto> {
    return this.resultados.registrar(id, dados, usuario)
  }

  @Delete(':id')
  @PapelMinimo(Papel.PRESIDENTE)
  @ApiForbiddenResponse({ description: SEM_PERMISSAO })
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
