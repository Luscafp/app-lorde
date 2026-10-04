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
  userInterfaceStyle: 'dark',
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
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-image',
    [
      'expo-image-picker',
      {
        photosPermission:
          'Permita acessar suas fotos para escolher a imagem de perfil ou de notícias.',
        cameraPermission: 'Permita usar a câmera para tirar a foto de perfil ou de notícias.',
        microphonePermission: false,
      },
    ],
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 200, backgroundColor: '#07090D' },
    ],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
})
