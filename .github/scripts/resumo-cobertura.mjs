// Resumo em Markdown da cobertura dos services da API (json-summary do Jest), para o
// GITHUB_STEP_SUMMARY. Uso: node resumo-cobertura.mjs apps/api/coverage/coverage-summary.json
import { existsSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'

// Mesmos limites do coverageThreshold em apps/api/jest.config.js (aplicados por arquivo).
const LIMITES = { lines: 70, statements: 70, functions: 70, branches: 60 }
const NOMES = { lines: 'Linhas', statements: 'Comandos', functions: 'Funções', branches: 'Ramos' }
const metricas = Object.keys(LIMITES)

const [arquivo = 'apps/api/coverage/coverage-summary.json'] = process.argv.slice(2)

console.log('## Cobertura dos services da API\n')

if (!existsSync(arquivo)) {
  console.log('Relatório de cobertura não encontrado (os testes não chegaram a rodar).')
  process.exit(0)
}

const resumo = JSON.parse(readFileSync(arquivo, 'utf8'))
const services = Object.keys(resumo).filter((chave) => chave !== 'total')

if (services.length === 0) {
  console.log('Nenhum `src/modules/**/*.service.ts` ainda; o limite de cobertura não se aplica.')
  process.exit(0)
}

const celula = (dados, metrica, comLimite) => {
  const pct = dados[metrica].pct
  if (!comLimite) return `${pct}%`
  return `${pct >= LIMITES[metrica] ? '✅' : '❌'} ${pct}%`
}

console.log(`| Arquivo | ${metricas.map((m) => `${NOMES[m]} (≥ ${LIMITES[m]}%)`).join(' | ')} |`)
console.log(`|---|${metricas.map(() => '---:').join('|')}|`)
for (const service of services.sort()) {
  const nome = relative(process.cwd(), service).replaceAll('\\', '/')
  console.log(
    `| \`${nome}\` | ${metricas.map((m) => celula(resumo[service], m, true)).join(' | ')} |`,
  )
}
console.log(`| **Total** | ${metricas.map((m) => celula(resumo.total, m, false)).join(' | ')} |`)
console.log('\nO limite vale para cada service; o total é informativo.')
