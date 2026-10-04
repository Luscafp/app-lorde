/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'

// Critério 15 do épico #6. app.config.ts: nome na loja, decisão D4 da #97 (fica com a #82).
const IGNORADOS = new Set(['node_modules', '__tests__', 'android', 'ios', 'app.config.ts'])
const raiz = path.resolve(__dirname, '..')

function arquivos(pasta: string): string[] {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    if (IGNORADOS.has(item.name) || item.name.startsWith('.expo')) return []
    const caminho = path.join(pasta, item.name)
    return item.isDirectory() ? arquivos(caminho) : [caminho]
  })
}

describe('nome da atlética fixo no código', () => {
  it('nenhum arquivo de apps/mobile cita "Lorde"', () => {
    const ocorrencias = arquivos(raiz)
      .filter((arquivo) => /lorde/i.test(fs.readFileSync(arquivo, 'utf8')))
      .map((arquivo) => path.relative(raiz, arquivo))

    expect(ocorrencias).toEqual([])
  })
})
