import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common'
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger'
import type { Response } from 'express'
import { Publico } from '../auth/decorators/publico.decorator'
import { SaudeErroDto, SaudeOkDto, type RespostaSaude } from './health.dto'
import { HealthService } from './health.service'

/** Público: consumido pelo healthcheck do deploy e pelo monitor de uptime (épico #4 §7). */
@ApiTags('health')
@Publico()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // O 503 é respondido aqui, fora do formato de erro padrão.
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Saúde da API e do banco (SELECT 1 com timeout de 2 s)' })
  @ApiOkResponse({ type: SaudeOkDto })
  @ApiServiceUnavailableResponse({ type: SaudeErroDto, description: 'Banco indisponível.' })
  async verificar(@Res({ passthrough: true }) res: Response): Promise<RespostaSaude> {
    const saude = await this.health.verificar()
    if (saude.status === 'erro') res.status(HttpStatus.SERVICE_UNAVAILABLE)
    return saude
  }
}
