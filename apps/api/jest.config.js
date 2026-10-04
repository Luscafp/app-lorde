const { globSync } = require('node:fs')

const SERVICES = 'src/modules/**/*.service.ts'

// O limite por glob só é aplicado quando algum arquivo casa: sem nenhum service o Jest
// falharia com "Coverage data for ... was not found".
const temServices = globSync(SERVICES, { cwd: __dirname }).length > 0

/** @type {import('jest').Config} */
const comum = {
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['@swc/jest'] },
  // O client gerado pelo Prisma (src/generated/prisma) importa os próprios arquivos com sufixo `.js`.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  setupFiles: ['<rootDir>/test/setup/env.ts'],
}

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    { ...comum, displayName: 'unit', roots: ['<rootDir>/src'], testRegex: String.raw`\.spec\.ts$` },
    // Postgres real (#42): migrations no globalSetup e banco vazio antes de cada teste. Rode com
    // --runInBand: os arquivos compartilham o mesmo banco.
    {
      ...comum,
      displayName: 'integration',
      roots: ['<rootDir>/test'],
      testRegex: String.raw`\.e2e-spec\.ts$`,
      globalSetup: '<rootDir>/test/setup/global-setup.ts',
      setupFilesAfterEnv: ['<rootDir>/test/setup/integracao.ts'],
    },
  ],
  // Cobertura medida sobre a soma dos projetos, só nos services de regra de negócio (RNF11).
  collectCoverageFrom: [SERVICES],
  // v8 mede sobre o TS original; o babel/istanbul contaria os helpers de decorator do SWC.
  coverageProvider: 'v8',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  ...(temServices && {
    coverageThreshold: {
      [`./${SERVICES}`]: { lines: 70, statements: 70, functions: 70, branches: 60 },
    },
  }),
}
