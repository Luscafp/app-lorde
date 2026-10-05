import {
  alterarSituacaoSchema,
  listarUsuariosQuerySchema,
  listaUsuariosSchema,
  Papel,
  situacaoAlteradaSchema,
  usuarioDetalheSchema,
  idParamSchema,
  type ListaUsuarios,
  type SituacaoAlterada,
  type UsuarioDetalhe,
} from '@atletica/shared'
import { Body, Controller, Get, Header, Param, Patch, Query } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { AtleticaAtual } from '../auth/decorators/atletica-atual.decorator'
import { PapelMinimo } from '../auth/decorators/papel-minimo.decorator'
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator'
import type { UsuarioAutenticado } from '../auth/tipos'
import { GestaoUsuariosService } from './gestao-usuarios.service'

class ListarUsuariosQueryDto extends createZodDto(listarUsuariosQuerySchema) {}
class UsuarioIdParamDto extends createZodDto(idParamSchema) {}
class AlterarSituacaoDto extends createZodDto(alterarSituacaoSchema) {}
class ListaUsuariosDto extends createZodDto(listaUsuariosSchema) {}
class UsuarioDetalheDto extends createZodDto(usuarioDetalheSchema) {}
class SituacaoAlteradaDto extends createZodDto(situacaoAlteradaSchema) {}

const ID_EXEMPLO = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'

const EXEMPLO_LISTA: ListaUsuarios = {
  items: [
    {
      id: ID_EXEMPLO,
      nome: 'José Lima',
      email: 'jose@exemplo.com',
      fotoUrl: null,
      papel: 'DIRETOR',
      situacao: 'ATIVO',
    },
  ],
  page: 1,
  limit: 20,
  total: 37,
}

const EXEMPLO_DETALHE: UsuarioDetalhe = {
  id: ID_EXEMPLO,
  nome: 'José Lima',
  email: 'jose@exemplo.com',
  fotoUrl: null,
  papel: 'DIRETOR',
  situacao: 'ATIVO',
  criadoEm: '2026-08-01T12:00:00.000Z',
  times: [
    {
      id: '3e7d9c1b-5a4f-4e2d-8b6a-9c0d1e2f3a4b',
      nome: 'Futsal Masculino',
      modalidade: { id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11', nome: 'Futsal' },
      capitao: false,
    },
  ],
  estatisticas: null,
  permissoes: {
    podeAlterarSituacao: true,
    motivoBloqueio: null,
    podeAlterarPapel: false,
    ehUltimoAdministrador: false,
  },
}

const NAO_ENCONTRADO = '`NOT_FOUND`: inexistente ou sem vínculo com a atlética do token.'

@ApiTags('Usuários')
@Controller('usuarios')
@PapelMinimo(Papel.PRESIDENTE)
@ApiUnauthorizedResponse({
  description: '`UNAUTHENTICATED`, `TOKEN_EXPIRED` ou `CONTA_DESATIVADA`.',
})
export class UsuariosController {
  constructor(private readonly gestao: GestaoUsuariosService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Lista e busca os usuários da atlética (UC23)',
    description:
      '`busca` (2–100 caracteres) procura parte do nome, sem diferenciar maiúsculas e acentos, ' +
      'ou do e-mail. Contas excluídas não aparecem. Ordenada por nome.',
  })
  @ApiOkResponse({ type: ListaUsuariosDto, example: EXEMPLO_LISTA })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR` (busca curta, `limit` > 50...).' })
  @ApiForbiddenResponse({ description: '`FORBIDDEN`: exige Presidência.' })
  listar(
    @Query() query: ListarUsuariosQueryDto,
    @AtleticaAtual() atleticaId: string,
  ): Promise<ListaUsuarios> {
    return this.gestao.listar(atleticaId, query)
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Perfil, times e permissões do solicitante sobre o usuário',
    description:
      '`situacao` = `EXCLUIDO` para conta excluída (dados anonimizados, sem times e sem ações).',
  })
  @ApiOkResponse({ type: UsuarioDetalheDto, example: EXEMPLO_DETALHE })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`: id não é UUID.' })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  detalhar(
    @Param() { id }: UsuarioIdParamDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<UsuarioDetalhe> {
    return this.gestao.detalhar(id, usuario)
  }

  @Patch(':id/status')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Desativa ou reativa a conta na atlética (UC23)',
    description:
      'Só sobre nível inferior ao do solicitante. Desativar revoga as sessões na atlética e ' +
      'corta o acesso na requisição seguinte. Repetir a situação atual responde 200 sem efeito.\n\n' +
      '| HTTP | code | Quando |\n|---|---|---|\n' +
      '| 400 | `VALIDATION_ERROR` | corpo diferente de `{ ativo: boolean }` |\n' +
      '| 403 | `FORBIDDEN` | solicitante sem Presidência |\n' +
      '| 403 | `NIVEL_INSUFICIENTE` | alvo de nível igual ou superior |\n' +
      '| 403 | `ALVO_PROPRIO` | a própria conta |\n' +
      '| 404 | `NOT_FOUND` | inexistente ou de outra atlética |\n' +
      '| 409 | `USUARIO_EXCLUIDO` | conta excluída |',
  })
  @ApiOkResponse({ type: SituacaoAlteradaDto, example: { id: ID_EXEMPLO, situacao: 'DESATIVADO' } })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`.' })
  @ApiForbiddenResponse({ description: '`FORBIDDEN`, `NIVEL_INSUFICIENTE` ou `ALVO_PROPRIO`.' })
  @ApiNotFoundResponse({ description: NAO_ENCONTRADO })
  @ApiConflictResponse({ description: '`USUARIO_EXCLUIDO`.' })
  alterarSituacao(
    @Param() { id }: UsuarioIdParamDto,
    @Body() { ativo }: AlterarSituacaoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<SituacaoAlterada> {
    return this.gestao.alterarSituacao(id, ativo, usuario)
  }
}
