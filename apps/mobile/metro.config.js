// O Expo (SDK ≥ 52) detecta o monorepo e inclui a raiz do workspace em `watchFolders`,
// o que cobre `packages/shared`. O Metro lê o fonte TS do shared pela condição `react-native`.
const { getDefaultConfig } = require('expo/metro-config')

module.exports = getDefaultConfig(__dirname)
