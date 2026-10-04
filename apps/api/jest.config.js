/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: String.raw`.*\.(e2e-)?spec\.ts$`,
  transform: { '^.+\\.ts$': ['@swc/jest'] },
  setupFiles: ['<rootDir>/test/setup/env.ts'],
  collectCoverageFrom: ['src/modules/**/*.service.ts'],
}
