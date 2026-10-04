import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../../src/infra/prisma/prisma.service'

/** Controller usado só nos testes de integração da extensão multi-atlética (#44). */
@Controller('escopo')
export class EscopoController {
  constructor(private readonly prisma: PrismaService) {}

  /** Sem guard, nada define a atlética no contexto: a extensão falha fechada. */
  @Get('eventos')
  eventos(): Promise<unknown> {
    return this.prisma.db.evento.findMany()
  }
}
