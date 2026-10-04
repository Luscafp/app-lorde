const { globSync } = require('node:fs')

const SERVICES = 'src/modules/**/*.service.ts'

// O limite por glob só é aplicado quando algum arquivo casa: sem nenhum service o Jest
// falharia com "Coverage data for ... was not found".
const temServices = globSync(SERVICES, { cwd: __dirname }).length > 0

/** @type {import('jest').Config} */
const comum = {
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['@swc/jest'] },
  setupFiles: ['<rootDir>/test/setup/env.ts'],
}

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    { ...comum, displayName: 'unit', roots: ['<rootDir>/src'], testRegex: String.raw`\.spec\.ts$` },
    // Testes de plataforma da #1; a #42 acrescenta globalSetup, limpeza do banco e fábricas.
    {
      ...comum,
      displayName: 'integration',
      roots: ['<rootDir>/test'],
      testRegex: String.raw`\.e2e-spec\.ts$`,
    },
  ],
  // Cobertura medida sobre a soma dos projetos, só nos services de regra de negócio (RNF11).
  collectCoverageFrom: [SERVICES],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  ...(temServices && {
    coverageThreshold: {
      [`./${SERVICES}`]: { lines: 70, statements: 70, functions: 70, branches: 60 },
    },
  }),
}
