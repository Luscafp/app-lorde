/**
 * @jest-environment node
 */
import path from 'node:path'

type ConfigMetro = {
  watchFolders: string[]
  resolver: { unstable_enablePackageExports?: boolean; unstable_conditionNames?: string[] }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../metro.config.js') as ConfigMetro

describe('metro.config.js (monorepo)', () => {
  it('observa packages/shared, para o Metro recarregar o fonte TS do shared', () => {
    const shared = path.resolve(__dirname, '../../../packages/shared')
    expect(config.watchFolders.map((pasta) => path.resolve(pasta))).toContain(shared)
  })

  it('resolve o campo exports, que aponta a condição react-native para o fonte', () => {
    expect(config.resolver.unstable_enablePackageExports).toBe(true)
  })
})
