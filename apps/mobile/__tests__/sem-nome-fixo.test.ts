/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'

// Critério 15 do épico #6 (RNF20). Varre o código que vai para o bundle; o nome do app na loja
// (app.config.ts) é a decisão D4 da #97 e fica com a #82.
const PASTAS = ['app', 'src']
const raiz = path.resolve(__dirname, '..')

function arquivos(pasta: string): string[] {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = path.join(pasta, item.name)
    return item.isDirectory() ? arquivos(caminho) : [caminho]
  })
}

describe('nome da atlética fixo no código', () => {
  it('nenhum arquivo de app/ ou src/ cita "Lorde"', () => {
    const ocorrencias = PASTAS.flatMap((pasta) => arquivos(path.join(raiz, pasta)))
      .filter((arquivo) => /lorde/i.test(fs.readFileSync(arquivo, 'utf8')))
      .map((arquivo) => path.relative(raiz, arquivo))

    expect(ocorrencias).toEqual([])
  })
})
