import { Controller, Get, Req } from '@nestjs/common'
import type { Request } from 'express'
import { Publico } from '../../src/modules/auth/decorators/publico.decorator'

/** Controller usado só no teste do `trust proxy` (#46). */
@Publico()
@Controller('suporte/proxy')
export class ProxyController {
  @Get('ip')
  ip(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip }
  }
}
