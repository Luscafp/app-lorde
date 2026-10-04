import { readFileSync, writeFileSync } from 'node:fs'
import ts from 'typescript'

// Uso: node scripts/transpilar-prisma-config.mjs <saida.mjs> (a imagem não leva fontes .ts).
const [saida] = process.argv.slice(2)
const { outputText } = ts.transpileModule(readFileSync('prisma.config.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
})
writeFileSync(saida, outputText)
