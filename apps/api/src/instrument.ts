import { existsSync } from 'node:fs'
import * as Sentry from '@sentry/nestjs'
import { envSchema } from './config/env.schema'
import { opcoesSentry } from './infra/sentry/sentry'

// Roda antes do ConfigModule: lê o `.env` como ele (sem sobrescrever o ambiente). Env inválida
// não inicia o Sentry; o ConfigModule a rejeita logo depois.
if (process.env.NODE_ENV !== 'test' && existsSync('.env')) process.loadEnvFile('.env')

const env = envSchema.safeParse(process.env)
const opcoes = env.success ? opcoesSentry(env.data) : undefined
if (opcoes) Sentry.init(opcoes)
