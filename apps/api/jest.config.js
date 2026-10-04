/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: String.raw`.*\.(e2e-)?spec\.ts$`,
  transform: { '^.+\\.ts$': ['@swc/jest'] },
  // O client gerado pelo Prisma (src/generated/prisma) importa os próprios arquivos com sufixo `.js`.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  setupFiles: ['<rootDir>/test/setup/env.ts'],
  collectCoverageFrom: ['src/modules/**/*.service.ts'],
}
