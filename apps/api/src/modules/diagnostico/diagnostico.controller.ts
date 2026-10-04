import { Controller, Get } from '@nestjs/common'

/** Erro forçado para o teste manual do Sentry (#93). Fica autenticada pelo guard global (#7). */
@Controller('diagnostico')
export class DiagnosticoController {
  @Get('erro')
  erro(): never {
    throw new Error('Erro de diagnóstico do Sentry')
  }
}
