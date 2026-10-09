import {
  idParamSchema,
  listaAuditoriaSchema,
  listarAuditoriaQuerySchema,
  Papel,
  registroAuditoriaDetalheSchema,
  type ListaAuditoria,
  type RegistroAuditoriaDetalhe,
} from '@atletica/shared'
import { Controller, Get, Header, Param, Query } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { PapelMinimo } from '../auth/decorators/papel-minimo.decorator'
import { AuditoriaConsultaService } from './auditoria-consulta.service'

class ListarAuditoriaQueryDto extends createZodDto(listarAuditoriaQuerySchema) {}
class RegistroIdParamDto extends createZodDto(idParamSchema) {}
class ListaAuditoriaDto extends createZodDto(listaAuditoriaSchema) {}
class RegistroAuditoriaDetalheDto extends createZodDto(registroAuditoriaDetalheSchema) {}

const ID_EXEMPLO = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const EVENTO_EXEMPLO = '3e7d9c1b-5a4f-4e2d-8b6a-9c0d1e2f3a4b'

const EXEMPLO_RESUMO = {
  id: ID_EXEMPLO,
  acao: 'RESULTADO_CORRIGIDO',
  entidade: 'Evento',
  entidadeId: EVENTO_EXEMPLO,
  autor: { id: '7c2e4b9a-1d3f-4a5b-8c6d-0e1f2a3b4c5d', nome: 'Ana Souza', anonimizado: false },
  criadoEm: '2026-10-12T23:40:00.000Z',
  resumo: { campos: ['placarTime', 'resultado'] },
}

const EXEMPLO_LISTA: ListaAuditoria = { items: [EXEMPLO_RESUMO], page: 1, limit: 20, total: 1 }

const EXEMPLO_DETALHE: RegistroAuditoriaDetalhe = {
  ...EXEMPLO_RESUMO,
  rotuloRegistro: 'Jogo Futsal 12/10/2026 19:00',
  dados: {
    antes: { placarTime: 2, resultado: 'EMPATE' },
    depois: { placarTime: 3, resultado: 'VITORIA' },
  },
  referencias: {
    usuarios: {},
    registros: { [EVENTO_EXEMPLO]: 'Jogo Futsal 12/10/2026 19:00' },
  },
}

@ApiTags('Auditoria')
@Controller('auditoria')
@PapelMinimo(Papel.PRESIDENTE)
@ApiUnauthorizedResponse({
  description: '`UNAUTHENTICATED`, `TOKEN_EXPIRED` ou `CONTA_DESATIVADA`.',
})
export class AuditoriaController {
  constructor(private readonly consulta: AuditoriaConsultaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Histórico de alterações da atlética (RF43)',
    description:
      'Do mais recente ao mais antigo. `de`/`ate`: `aaaa-mm-dd` (dia inteiro em ' +
      'America/Fortaleza) ou instante ISO-8601; sem `de`, os últimos 30 dias; no máximo 366 ' +
      'dias. `entidadeId` exige `entidade` (para `Participacao`, é o `eventoId`). `usuarioId` ' +
      'filtra pelo autor. `autor: null` = ação do sistema; conta excluída vem anonimizada. ' +
      '`resumo.campos` traz só os nomes dos campos alterados.',
  })
  @ApiOkResponse({ type: ListaAuditoriaDto, example: EXEMPLO_LISTA })
  @ApiBadRequestResponse({
    description: '`VALIDATION_ERROR`: catálogo, período invertido ou > 366 dias, `limit` > 50.',
  })
  listar(@Query() query: ListarAuditoriaQueryDto): Promise<ListaAuditoria> {
    return this.consulta.listar(query)
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Detalhe do registro: `dados` (antes/depois) e nomes dos ids citados',
  })
  @ApiOkResponse({ type: RegistroAuditoriaDetalheDto, example: EXEMPLO_DETALHE })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não é UUID.' })
  @ApiNotFoundResponse({ description: '`NOT_FOUND`: inexistente ou de outra atlética.' })
  detalhar(@Param() { id }: RegistroIdParamDto): Promise<RegistroAuditoriaDetalhe> {
    return this.consulta.detalhar(id)
  }
}
