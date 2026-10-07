import type { ConfigContext, ExpoConfig } from 'expo/config'
import { z } from 'zod'
import { AMBIENTES, type Ambiente } from './src/config/ambiente.ts'

/** Decisões da #97 num só lugar: nome, pacote (permanente após publicar) e projeto EAS. */
const NOME_APP = 'Atlética Lorde'
const IDENTIFICADOR_ANDROID = 'br.com.atleticalorde.app'
/** Gerado pelo `eas init` na #95. */
const ID_PROJETO_EAS = '00000000-0000-0000-0000-000000000000'

const esquemaEnv = z
  .object({
    EXPO_PUBLIC_AMBIENTE: z.enum(AMBIENTES, {
      error: 'EXPO_PUBLIC_AMBIENTE deve ser development | homologacao | producao',
    }),
    EXPO_PUBLIC_API_URL: z.url({ error: 'EXPO_PUBLIC_API_URL deve ser uma URL' }),
  })
  .refine(
    (env) =>
      env.EXPO_PUBLIC_AMBIENTE === 'development' || env.EXPO_PUBLIC_API_URL.startsWith('https://'),
    {
      path: ['EXPO_PUBLIC_API_URL'],
      error: 'EXPO_PUBLIC_API_URL deve usar https:// fora de development',
    },
  )

function variante(ambiente: Ambiente) {
  if (ambiente !== 'homologacao') {
    return { nome: NOME_APP, pacote: IDENTIFICADOR_ANDROID, sufixoIcone: '' }
  }
  return {
    nome: `${NOME_APP} (Homolog)`,
    pacote: `${IDENTIFICADOR_ANDROID}.homolog`,
    sufixoIcone: '-homolog',
  }
}

function lerEnv() {
  const resultado = esquemaEnv.safeParse(process.env)
  if (!resultado.success) {
    throw new Error(`Configuração do app inválida:\n${z.prettifyError(resultado.error)}`)
  }
  return resultado.data
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const { EXPO_PUBLIC_AMBIENTE: ambiente, EXPO_PUBLIC_API_URL: apiUrl } = lerEnv()
  const { nome, pacote, sufixoIcone } = variante(ambiente)

  return {
    ...config,
    name: nome,
    slug: 'atletica-lorde',
    scheme: 'atletica',
    version: '1.0.0',
    orientation: 'portrait',
    icon: `./assets/icon${sufixoIcone}.png`,
    userInterfaceStyle: 'dark',
    runtimeVersion: { policy: 'fingerprint' },
    updates: {
      url: `https://u.expo.dev/${ID_PROJETO_EAS}`,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },
    android: {
      package: pacote,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: `./assets/android-icon-foreground${sufixoIcone}.png`,
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-font',
      'expo-image',
      'expo-updates',
      // targetSdk/compileSdk ficam os do SDK Expo.
      ['expo-build-properties', { android: { minSdkVersion: 26 } }],
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
      // Upload de source maps no EAS; o SENTRY_AUTH_TOKEN fica só nos segredos do EAS (#95).
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          organization: process.env.SENTRY_ORG ?? 'atletica-lorde',
          project: process.env.SENTRY_PROJECT ?? 'atletica-app',
        },
      ],
    ],
    extra: {
      apiUrl,
      ambiente,
      eas: { projectId: ID_PROJETO_EAS },
    },
  }
}
