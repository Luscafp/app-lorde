/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // pnpm guarda os pacotes em node_modules/.pnpm/<pacote>/node_modules/<pacote>.
  transformIgnorePatterns: [
    String.raw`node_modules/(?!(?:\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|@atletica/.*))`,
  ],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
}
