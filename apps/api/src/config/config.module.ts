import { ConfigModule } from '@nestjs/config'
import { validarEnv } from './env.schema'

/** ConfigModule global; a API não sobe com env inválida. Nos testes o `.env` é ignorado. */
export const ConfiguracaoModule = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  ignoreEnvFile: process.env.NODE_ENV === 'test',
  validate: validarEnv,
})
