import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Mesmo nível em src/config e dist/config: os dois chegam ao package.json da API.
const { version } = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
) as { version: string }

export const VERSAO_API = version

/** SHA curto do build: `GIT_COMMIT_SHA` (injetada no `docker build`) ou `RAILWAY_GIT_COMMIT_SHA`. */
export function commitApi(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return (env.GIT_COMMIT_SHA || env.RAILWAY_GIT_COMMIT_SHA)?.trim().slice(0, 7) || undefined
}

/** `<versao>+<commit>`, com `local` quando o commit não é conhecido. */
export function versaoApi(commit = commitApi()): string {
  return `${version}+${commit || 'local'}`
}
