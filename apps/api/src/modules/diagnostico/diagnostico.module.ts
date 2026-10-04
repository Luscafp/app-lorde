import { Module } from '@nestjs/common'
import { ConditionalModule } from '@nestjs/config'
import { DiagnosticoController } from './diagnostico.controller'

@Module({ controllers: [DiagnosticoController] })
export class DiagnosticoModule {}

/** Não registrado em produção: `GET /diagnostico/erro` responde 404 lá. */
export const DiagnosticoForaDeProducao = ConditionalModule.registerWhen(
  DiagnosticoModule,
  (env) => env.APP_ENV !== 'producao',
  { debug: false },
)
