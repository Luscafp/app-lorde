import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Mesmo nível em src/config e dist/config: os dois chegam ao package.json da API.
const { version } = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
) as { version: string }

/** `<versao>+<commit>`; o commit vem da Railway (`RAILWAY_GIT_COMMIT_SHA`), `local` fora dela. */
export function versaoApi(commit = process.env.RAILWAY_GIT_COMMIT_SHA): string {
  return `${version}+${commit?.slice(0, 7) || 'local'}`
}
