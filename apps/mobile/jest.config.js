// O app.config.ts, lido pelo metro.config.js nos testes, roda fora do sandbox e exige o ambiente.
process.env.EXPO_PUBLIC_AMBIENTE ??= 'development'
process.env.EXPO_PUBLIC_API_URL ??= 'http://localhost:3000/api/v1'

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // pnpm guarda os pacotes em node_modules/.pnpm/<pacote>/node_modules/<pacote>.
  transformIgnorePatterns: [
    String.raw`node_modules/(?!(?:\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|standard-navigation|@atletica/.*))`,
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.css$': '<rootDir>/__mocks__/estilo.js',
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // O primeiro render de cada arquivo carrega e transforma os componentes do RN sob demanda;
  // no CI sem cache isso passava dos 5 s padrão (ex.: usuarios.test.tsx).
  testTimeout: 15_000,
}
