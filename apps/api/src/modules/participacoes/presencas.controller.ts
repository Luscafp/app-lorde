import {
  idParamSchema,
  listaPresencaDtoSchema,
  Papel,
  registrarPresencasSchema,
  type ListaPresencaDto,
} from '@atletica/shared'
import { Body, Controller, Get, Header, Param, Put } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
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
import { PresencasService } from './presencas.service'

class EventoIdDto extends createZodDto(idParamSchema) {}
class RegistrarPresencasDto extends createZodDto(registrarPresencasSchema) {}
class ListaPresencaRespostaDto extends createZodDto(listaPresencaDtoSchema) {}

const EXEMPLO: ListaPresencaDto = {
  eventoId: '3c9a7b1e-5d2f-4e8a-9b6c-0d1e2f3a4b5c',
  status: 'FINALIZADO',
  registrada: false,
  registradaEm: null,
  itens: [
    {
      usuarioId: 'c1c1c1c1-0000-4000-8000-000000000001',
      nome: 'Ana Souza',
      fotoUrl: 'https://cdn.exemplo.com/usuarios/ana.webp',
      resposta: 'CONFIRMOU',
      presente: true,
    },
    {
      usuarioId: 'c1c1c1c1-0000-4000-8000-000000000002',
      nome: 'Usuário excluído',
      fotoUrl: null,
      resposta: 'SEM_RESPOSTA',
      presente: false,
    },
  ],
}

const NAO_ENCONTRADO = '`NOT_FOUND`: evento inexistente, excluído ou de outra atlética.'

@ApiTags('Eventos')
@ApiUnauthorizedResponse({ description: '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.' })
@ApiNotFoundResponse({ description: NAO_ENCONTRADO })
@PapelMinimo(Papel.DIRETOR)
@Controller('eventos')
export class PresencasController {
  constructor(private readonly presencas: PresencasService) {}

  @Get(':id/presencas')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Lista de presença do evento (Diretor+)',
    description:
      'Elenco do evento: membros cujo vínculo cobria o início (`entradaEm <= inicio` e `saidaEm` ' +
      'nulo ou posterior). Sem chamada registrada, `presente` vem marcado para quem confirmou. ' +
      'Contas excluídas aparecem como "Usuário excluído", sem foto. Ordenada por nome, sem paginação.',
  })
  @ApiOkResponse({ type: ListaPresencaRespostaDto, example: EXEMPLO })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não-UUID.' })
  listar(@Param() { id }: EventoIdDto): Promise<ListaPresencaDto> {
    return this.presencas.listar(id)
  }

  @Put(':id/presencas')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Registra ou corrige a presença do evento (Diretor+)',
    description:
      'Substitui a chamada inteira: os ids enviados ficam `presente = true` e o restante do ' +
      'elenco `false`, sem alterar a resposta do atleta. Só em `EM_ANDAMENTO` ou `FINALIZADO`. ' +
      'Grava `PRESENCAS_REGISTRADAS` na auditoria; a mesma lista já registrada responde 200 sem ' +
      'gravar nada.',
  })
  @ApiBody({
    type: RegistrarPresencasDto,
    examples: {
      presentes: { value: { presentes: ['c1c1c1c1-0000-4000-8000-000000000001'] } },
      ninguem: { value: { presentes: [] } },
    },
  })
  @ApiOkResponse({ type: ListaPresencaRespostaDto })
  @ApiBadRequestResponse({
    description: '`VALIDATION_ERROR`: id não-UUID, ids repetidos, mais de 200 ou campo extra.',
  })
  @ApiUnprocessableEntityResponse({
    description:
      '`EVENTO_STATUS_INVALIDO` (agendado ou cancelado) ou `ATLETA_FORA_DO_ELENCO` ' +
      '(`details: [{ field: "presentes", message: "<usuarioId>" }]`).',
  })
  registrar(
    @Param() { id }: EventoIdDto,
    @Body() { presentes }: RegistrarPresencasDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<ListaPresencaDto> {
    return this.presencas.registrar(id, presentes, usuario)
  }
}
