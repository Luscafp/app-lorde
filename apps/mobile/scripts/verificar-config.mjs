// Resolve o app.config.ts dos três ambientes com o Expo CLI; falha se algum não resolver.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const cliExpo = createRequire(import.meta.url).resolve('expo/bin/cli')

const AMBIENTES = {
  development: 'http://localhost:3000/api/v1',
  homologacao: 'https://api-homologacao.exemplo.com/api/v1',
  producao: 'https://api.exemplo.com/api/v1',
}

for (const [ambiente, apiUrl] of Object.entries(AMBIENTES)) {
  const saida = execFileSync(process.execPath, [cliExpo, 'config', '--type', 'public', '--json'], {
    env: { ...process.env, EXPO_PUBLIC_AMBIENTE: ambiente, EXPO_PUBLIC_API_URL: apiUrl },
    encoding: 'utf8',
  })
  const config = JSON.parse(saida)
  console.log(`${ambiente}: ${config.name} · ${config.android.package} · ${config.updates.url}`)
}
