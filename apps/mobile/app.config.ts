import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Identificador Android: decisão D4 (#97), recomendação adotada. Só pode mudar antes da
 * primeira publicação; variantes por ambiente (`.homolog`) são da #82.
 */
const IDENTIFICADOR_ANDROID = 'br.com.atleticalorde.app'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Atlética Lorde',
  slug: 'atletica-lorde',
  scheme: 'atletica',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  android: {
    package: IDENTIFICADOR_ANDROID,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: ['expo-router'],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
})
