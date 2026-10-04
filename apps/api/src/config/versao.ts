import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Env } from './env.schema'

// Mesmo nível em src/config e dist/config: os dois chegam ao package.json da API.
const { version } = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
) as { version: string }

export const VERSAO_API = version

export type EnvCommit = Partial<Pick<Env, 'GIT_COMMIT_SHA' | 'RAILWAY_GIT_COMMIT_SHA'>>

/** SHA curto do build (`GIT_COMMIT_SHA` ou `RAILWAY_GIT_COMMIT_SHA`); `desconhecido` sem nenhuma. */
export function commitApi(env: EnvCommit): string {
  return (env.GIT_COMMIT_SHA ?? env.RAILWAY_GIT_COMMIT_SHA)?.slice(0, 7) ?? 'desconhecido'
}

/** `<versao>+<commit>`, usado no log e no `release` do Sentry. */
export function versaoApi(env: EnvCommit): string {
  return `${VERSAO_API}+${commitApi(env)}`
}
