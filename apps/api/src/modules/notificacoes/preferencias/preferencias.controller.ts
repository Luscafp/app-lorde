import {
  atualizarPreferenciasSchema,
  preferenciasSchema,
  type Preferencias,
} from '@atletica/shared'
import { Body, Controller, Get, Header, Patch } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { UsuarioAtual } from '../../auth/decorators/usuario-atual.decorator'
import type { UsuarioAutenticado } from '../../auth/tipos'
import { PreferenciasService } from './preferencias.service'

class AtualizarPreferenciasDto extends createZodDto(atualizarPreferenciasSchema) {}
class PreferenciasDto extends createZodDto(preferenciasSchema) {}

const EXEMPLO: Preferencias = {
  pushAtivo: true,
  novosEventos: true,
  alteracoesEventos: true,
  lembretes: true,
  antecedenciaLembreteHoras: 2,
  resultados: true,
  noticias: false,
  solicitacoes: true,
  avisos: true,
}

/** Recurso da própria conta (sem `atleticaId`): não existe 403 nem 404. */
@ApiTags('Notificações')
@ApiUnauthorizedResponse({ description: '`UNAUTHENTICATED` ou `TOKEN_EXPIRED`.' })
@Controller('me/preferencias-notificacao')
export class PreferenciasController {
  constructor(private readonly preferencias: PreferenciasService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Preferências de notificação do usuário autenticado (UC12)',
    description: 'Sem registro (conta antiga), cria com os padrões da seção 3.4 e o devolve.',
  })
  @ApiOkResponse({ type: PreferenciasDto, example: EXEMPLO })
  obter(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<Preferencias> {
    return this.preferencias.obter(usuario.id)
  }

  @Patch()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Altera as preferências enviadas (UC12)',
    description:
      'Só os campos do corpo mudam; responde o objeto completo. A notificação de cargo é ' +
      'sempre enviada e não tem preferência (RN35).',
  })
  @ApiBody({
    type: AtualizarPreferenciasDto,
    examples: {
      noticias: { value: { noticias: false } },
      antecedencia: { value: { antecedenciaLembreteHoras: 24 } },
    },
  })
  @ApiOkResponse({ type: PreferenciasDto, example: EXEMPLO })
  @ApiBadRequestResponse({
    description:
      '`VALIDATION_ERROR`: corpo vazio, campo desconhecido, tipo errado ou ' +
      '`antecedenciaLembreteHoras` fora de 1, 2, 6 e 24.',
  })
  atualizar(
    @Body() dados: AtualizarPreferenciasDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Preferencias> {
    return this.preferencias.atualizar(usuario.id, dados)
  }
}
