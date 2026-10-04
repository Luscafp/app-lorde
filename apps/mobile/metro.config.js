// O Expo (SDK ≥ 52) detecta o monorepo e inclui a raiz do workspace em `watchFolders`,
// o que cobre `packages/shared` (garantido por __tests__/metro-config.test.ts). O Metro lê o fonte TS
// do shared pela condição `react-native`.
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

module.exports = withNativeWind(getDefaultConfig(__dirname), { input: './global.css' })
