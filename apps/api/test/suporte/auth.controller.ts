import { Papel } from '@atletica/shared'
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common'
import { ContextoAtletica } from '../../src/infra/contexto/contexto-atletica.service'
import { PrismaService } from '../../src/infra/prisma/prisma.service'
import { AtleticaAtual } from '../../src/modules/auth/decorators/atletica-atual.decorator'
import { PapelMinimo } from '../../src/modules/auth/decorators/papel-minimo.decorator'
import { Publico } from '../../src/modules/auth/decorators/publico.decorator'
import { UsuarioAtual } from '../../src/modules/auth/decorators/usuario-atual.decorator'
import type { UsuarioAutenticado } from '../../src/modules/auth/tipos'

/** Controller usado só nos testes de integração da autenticação (#7). */
@Controller('teste-auth')
export class AuthTesteController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: ContextoAtletica,
  ) {}

  @Get('livre')
  livre(): { ok: true } {
    return { ok: true }
  }

  @Publico()
  @Get('publica')
  publica(@UsuarioAtual() usuario: UsuarioAutenticado | undefined) {
    return { ok: true, usuario: usuario ?? null, atleticaId: this.contexto.atleticaId() ?? null }
  }

  @PapelMinimo(Papel.DIRETOR)
  @Get('diretoria')
  diretoria(): { ok: true } {
    return { ok: true }
  }

  @PapelMinimo(Papel.PRESIDENTE)
  @Get('presidencia')
  presidencia(): { ok: true } {
    return { ok: true }
  }

  @PapelMinimo(Papel.ADMINISTRADOR)
  @Get('administracao')
  administracao(): { ok: true } {
    return { ok: true }
  }

  @Get('eu')
  eu(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @UsuarioAtual('papel') papel: Papel,
    @AtleticaAtual() atleticaId: string,
  ) {
    return { usuario, papel, atleticaId, contexto: this.contexto.atleticaId() }
  }

  @Get('eventos/:id')
  evento(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.db.evento.findUniqueOrThrow({ where: { id } })
  }

  @Get('times/:id')
  time(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.db.time.findUniqueOrThrow({ where: { id } })
  }
}
