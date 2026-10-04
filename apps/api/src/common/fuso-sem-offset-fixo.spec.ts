import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = join(__dirname, '..', '..', '..', '..')
const PASTAS = [
  'apps/api/src',
  'apps/api/prisma',
  'apps/mobile/app',
  'apps/mobile/src',
  'packages/shared/src',
]
const IGNORADAS = ['generated', 'node_modules']
// Montado em partes para este arquivo não acusar a si mesmo.
const OFFSET_FIXO = new RegExp(['-03', '00'].join(':'))

function arquivosTs(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = join(pasta, item.name)
    if (item.isDirectory()) return IGNORADAS.includes(item.name) ? [] : arquivosTs(caminho)
    return /\.tsx?$/.test(item.name) ? [caminho] : []
  })
}

/** Datas usam `FUSO_PADRAO` do shared, nunca offset fixo (convenções §4.5, #50). */
describe('fuso sem offset fixo', () => {
  it('nenhum arquivo do código usa o offset fixo de America/Fortaleza', () => {
    const arquivos = PASTAS.flatMap((pasta) => arquivosTs(join(RAIZ, pasta)))
    const comOffset = arquivos
      .filter((arquivo) => OFFSET_FIXO.test(readFileSync(arquivo, 'utf8')))
      .map((arquivo) => relative(RAIZ, arquivo))

    expect(arquivos.length).toBeGreaterThan(0)
    expect(comOffset).toEqual([])
  })
})
