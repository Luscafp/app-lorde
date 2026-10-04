import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../../src/infra/prisma/prisma.service'
import { Publico } from '../../src/modules/auth/decorators/publico.decorator'

/** Controller usado só nos testes de integração da extensão multi-atlética (#44). */
@Controller('escopo')
export class EscopoController {
  constructor(private readonly prisma: PrismaService) {}

  /** Rota pública: nada define a atlética no contexto e a extensão falha fechada. */
  @Publico()
  @Get('eventos')
  eventos(): Promise<unknown> {
    return this.prisma.db.evento.findMany()
  }
}
