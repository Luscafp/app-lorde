// O Expo (SDK ≥ 52) detecta o monorepo e inclui a raiz do workspace em `watchFolders`,
// o que cobre `packages/shared` (garantido por __tests__/metro-config.test.ts). O Metro lê o fonte TS
// do shared pela condição `react-native`. `getSentryExpoConfig` acrescenta os debug IDs dos source maps.
const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const { withNativeWind } = require('nativewind/metro')

module.exports = withNativeWind(getSentryExpoConfig(__dirname), { input: './global.css' })
