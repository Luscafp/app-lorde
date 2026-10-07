import {
  listaSolicitacoesSchema,
  listarSolicitacoesQuerySchema,
  Papel,
  solicitacaoIdSchema,
  solicitacaoPainelDtoSchema,
  type ListaSolicitacoes,
  type SolicitacaoPainelDto,
} from '@atletica/shared'
import { Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
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
import { SolicitacoesPainelService } from './solicitacoes-painel.service'

class ListarSolicitacoesQueryDto extends createZodDto(listarSolicitacoesQuerySchema) {}
class SolicitacaoIdDto extends createZodDto(solicitacaoIdSchema) {}
class SolicitacaoPainelRespostaDto extends createZodDto(solicitacaoPainelDtoSchema) {}
class ListaSolicitacoesDto extends createZodDto(listaSolicitacoesSchema) {}

const DIRETOR_EXEMPLO = {
  id: 'c9d8e7f6-a5b4-4c3d-9e2f-1a0b9c8d7e6f',
  nome: 'Maria Diretora',
  fotoUrl: null,
}

const EXEMPLO: SolicitacaoPainelDto = {
  id: 'd4c3b2a1-6f5e-4b7a-9c8d-1e0f2a3b4c5d',
  status: 'PENDENTE',
  criadaEm: '2026-09-28T12:00:00.000Z',
  avaliadaEm: null,
  canceladaEm: null,
  usuario: { id: 'e3f2a1b0-9c8d-4e7f-8a6b-5c4d3e2f1a0b', nome: 'Carlos Lima', fotoUrl: null },
  time: {
    id: 'b2a1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    nome: 'Futsal Masculino',
    modalidade: { id: '6f5e4d3c-2b1a-4f0e-9d8c-7b6a5f4e3d2c', nome: 'Futsal', icone: 'soccer' },
  },
  avaliadoPor: null,
}

const avaliada = (status: 'APROVADA' | 'REJEITADA'): SolicitacaoPainelDto => ({
  ...EXEMPLO,
  status,
  avaliadaEm: '2026-09-30T15:00:00.000Z',
  avaliadoPor: DIRETOR_EXEMPLO,
})

const NAO_AUTENTICADO = '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.'
const SEM_PERMISSAO = '`FORBIDDEN`: exige DIRETOR ou superior.'
const ID_INVALIDO = '`VALIDATION_ERROR`: id não-UUID.'
const NAO_ENCONTRADA = '`NOT_FOUND`: solicitação inexistente ou de outra atlética.'
const JA_ENCERRADA =
  '`SOLICITACAO_CANCELADA` (o atleta cancelou antes) ou `SOLICITACAO_JA_AVALIADA` (outro diretor avaliou antes).'

@ApiTags('Painel — Solicitações')
@ApiUnauthorizedResponse({ description: NAO_AUTENTICADO })
@ApiForbiddenResponse({ description: SEM_PERMISSAO })
@PapelMinimo(Papel.DIRETOR)
@Controller('solicitacoes')
export class SolicitacoesPainelController {
  constructor(private readonly solicitacoes: SolicitacoesPainelService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Lista as solicitações de entrada da atlética',
    description:
      '`status` repetível (padrão `PENDENTE`). Só pendentes: mais antigas primeiro; ' +
      'demais: data de encerramento (`avaliadaEm` ou `canceladaEm`) mais recente primeiro.',
  })
  @ApiOkResponse({
    type: ListaSolicitacoesDto,
    example: { items: [EXEMPLO], page: 1, limit: 20, total: 1 },
  })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: query inválida.' })
  listar(
    @Query() query: ListarSolicitacoesQueryDto,
    @UsuarioAtual('atleticaId') atleticaId: string,
  ): Promise<ListaSolicitacoes> {
    return this.solicitacoes.listar(atleticaId, query)
  }

  @Post(':id/aprovar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Aceita a solicitação e adiciona o atleta ao elenco',
    description:
      'Grava `SOLICITACAO_APROVADA` e `MEMBRO_ADICIONADO` na mesma transação e emite ' +
      '`solicitacao.avaliada` após o commit. Se o atleta já está no elenco, não duplica o vínculo.',
  })
  @ApiOkResponse({ type: SolicitacaoPainelRespostaDto, example: avaliada('APROVADA') })
  @ApiBadRequestResponse({ description: ID_INVALIDO })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADA })
  @ApiConflictResponse({ description: JA_ENCERRADA })
  @ApiUnprocessableEntityResponse({ description: '`TIME_INATIVO`.' })
  aprovar(
    @Param() { id }: SolicitacaoIdDto,
    @UsuarioAtual('id') avaliadorId: string,
  ): Promise<SolicitacaoPainelDto> {
    return this.solicitacoes.aprovar(id, avaliadorId)
  }

  @Post(':id/rejeitar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Rejeita a solicitação',
    description:
      'Sem corpo (sem motivo). Grava `SOLICITACAO_REJEITADA` e emite `solicitacao.avaliada` após o commit.',
  })
  @ApiOkResponse({ type: SolicitacaoPainelRespostaDto, example: avaliada('REJEITADA') })
  @ApiBadRequestResponse({ description: ID_INVALIDO })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADA })
  @ApiConflictResponse({ description: JA_ENCERRADA })
  rejeitar(
    @Param() { id }: SolicitacaoIdDto,
    @UsuarioAtual('id') avaliadorId: string,
  ): Promise<SolicitacaoPainelDto> {
    return this.solicitacoes.rejeitar(id, avaliadorId)
  }
}
