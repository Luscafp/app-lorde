// Resolve o app.config.ts com o `env` de cada perfil do eas.json; falha se algum não resolver.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const cliExpo = createRequire(import.meta.url).resolve('expo/bin/cli')
const { build: perfis } = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'))

function envDoPerfil(nome) {
  const { extends: base, env } = perfis[nome]
  return { ...(base && envDoPerfil(base)), ...env }
}

for (const nome of Object.keys(perfis)) {
  const saida = execFileSync(process.execPath, [cliExpo, 'config', '--type', 'public', '--json'], {
    env: { ...process.env, ...envDoPerfil(nome) },
    encoding: 'utf8',
  })
  const config = JSON.parse(saida)
  console.log(`${nome}: ${config.name} · ${config.android.package} · ${config.extra.apiUrl}`)
}
