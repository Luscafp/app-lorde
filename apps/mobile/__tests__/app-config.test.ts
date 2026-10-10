/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'
import type { ExpoConfig } from 'expo/config'
import resolverConfig from '../app.config'
import { AMBIENTES, type Ambiente } from '@/config/ambiente'

const URL_HTTPS = 'https://api.exemplo.com/api/v1'
const ENV_ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ENV_ORIGINAL }
})

function resolver(env: Record<string, string | undefined>): ExpoConfig {
  process.env = { ...ENV_ORIGINAL, SENTRY_ORG: undefined, SENTRY_PROJECT: undefined, ...env }
  return resolverConfig({ config: {} } as Parameters<typeof resolverConfig>[0])
}

function resolverAmbiente(ambiente: Ambiente): ExpoConfig {
  return resolver({ EXPO_PUBLIC_AMBIENTE: ambiente, EXPO_PUBLIC_API_URL: URL_HTTPS })
}

function plugin(config: ExpoConfig, nome: string): unknown[] | undefined {
  const encontrado = config.plugins?.find((item) => (Array.isArray(item) ? item[0] : item) === nome)
  if (encontrado === undefined) return undefined
  return Array.isArray(encontrado) ? encontrado : [encontrado]
}

describe('app.config.ts por ambiente', () => {
  it('homologação: pacote .homolog, nome "(Homolog)" e ícone de homologação', () => {
    const config = resolverAmbiente('homologacao')

    expect(config.android?.package).toBe('br.com.atleticalorde.app.homolog')
    expect(config.name).toBe('Atlética Lorde (Homolog)')
    expect(config.icon).toBe('./assets/icon-homolog.png')
    expect(config.android?.adaptiveIcon?.foregroundImage).toBe(
      './assets/android-icon-foreground-homolog.png',
    )
  })

  it.each<Ambiente>(['producao', 'development'])(
    '%s: pacote base, nome sem sufixo e ícone padrão',
    (ambiente) => {
      const config = resolverAmbiente(ambiente)

      expect(config.android?.package).toBe('br.com.atleticalorde.app')
      expect(config.name).toBe('Atlética Lorde')
      expect(config.icon).toBe('./assets/icon.png')
      expect(config.android?.adaptiveIcon?.foregroundImage).toBe(
        './assets/android-icon-foreground.png',
      )
    },
  )

  it.each(AMBIENTES)(
    '%s: versão, Android 8.0, OTA por fingerprint e plugins de release',
    (ambiente) => {
      const config = resolverAmbiente(ambiente)

      expect(config.version).toBe('1.0.0')
      expect(config.runtimeVersion).toEqual({ policy: 'fingerprint' })
      expect(config.updates?.url).toMatch(/^https:\/\/u\.expo\.dev\/[0-9a-f-]{36}$/)
      expect(config.updates).toMatchObject({
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 0,
      })
      expect(plugin(config, 'expo-build-properties')).toEqual([
        'expo-build-properties',
        { android: { minSdkVersion: 26 } },
      ])
      expect(plugin(config, 'expo-updates')).toBeDefined()
      expect(plugin(config, '@sentry/react-native/expo')?.[1]).toEqual({
        url: 'https://sentry.io/',
        organization: 'atletica-lorde',
        project: 'atletica-app',
      })
      expect(config.android?.blockedPermissions).toEqual(
        expect.arrayContaining([
          'android.permission.RECORD_AUDIO',
          'android.permission.SYSTEM_ALERT_WINDOW',
        ]),
      )
      expect(config.extra).toMatchObject({ apiUrl: URL_HTTPS, ambiente })
      expect(config.extra?.eas).toHaveProperty('projectId', config.updates?.url?.split('/').pop())
    },
  )

  it.each(AMBIENTES)('%s: os ícones referenciados existem', (ambiente) => {
    const config = resolverAmbiente(ambiente)
    const icones = [config.icon, ...Object.values(config.android?.adaptiveIcon ?? {})].filter(
      (valor): valor is string => typeof valor === 'string' && valor.startsWith('./'),
    )

    for (const icone of icones)
      expect(fs.existsSync(path.resolve(__dirname, '..', icone))).toBe(true)
  })

  it('notificações: plugin com ícone monocromático, cor neutra e canal "padrao"; sem google-services', () => {
    const config = resolver({
      EXPO_PUBLIC_AMBIENTE: 'producao',
      EXPO_PUBLIC_API_URL: URL_HTTPS,
      COR_NOTIFICACAO: undefined,
      GOOGLE_SERVICES_JSON: undefined,
    })

    expect(plugin(config, 'expo-notifications')?.[1]).toEqual({
      icon: './assets/android-icon-monochrome.png',
      color: '#6B7280',
      defaultChannel: 'padrao',
    })
    expect(config.android).not.toHaveProperty('googleServicesFile')
  })

  it('notificações: cor e google-services.json vêm do ambiente do EAS', () => {
    const config = resolver({
      EXPO_PUBLIC_AMBIENTE: 'producao',
      EXPO_PUBLIC_API_URL: URL_HTTPS,
      COR_NOTIFICACAO: '#E11D48',
      GOOGLE_SERVICES_JSON: '/tmp/eas/google-services.json',
    })

    expect(plugin(config, 'expo-notifications')?.[1]).toMatchObject({ color: '#E11D48' })
    expect(config.android?.googleServicesFile).toBe('/tmp/eas/google-services.json')
  })

  it('recusa COR_NOTIFICACAO fora de #RRGGBB', () => {
    expect(() =>
      resolver({
        EXPO_PUBLIC_AMBIENTE: 'producao',
        EXPO_PUBLIC_API_URL: URL_HTTPS,
        COR_NOTIFICACAO: 'vermelho',
      }),
    ).toThrow(/COR_NOTIFICACAO/)
  })

  it('development aceita a URL http:// local', () => {
    const config = resolver({
      EXPO_PUBLIC_AMBIENTE: 'development',
      EXPO_PUBLIC_API_URL: 'http://192.168.0.10:3000/api/v1',
    })

    expect(config.extra?.apiUrl).toBe('http://192.168.0.10:3000/api/v1')
  })

  it.each<Ambiente>(['homologacao', 'producao'])('%s recusa URL sem https://', (ambiente) => {
    expect(() =>
      resolver({ EXPO_PUBLIC_AMBIENTE: ambiente, EXPO_PUBLIC_API_URL: 'http://api.exemplo.com' }),
    ).toThrow(/EXPO_PUBLIC_API_URL.*https:\/\//s)
  })

  it.each([undefined, '', 'nao-e-url'])('recusa EXPO_PUBLIC_API_URL %p', (url) => {
    expect(() =>
      resolver({ EXPO_PUBLIC_AMBIENTE: 'development', EXPO_PUBLIC_API_URL: url }),
    ).toThrow(/EXPO_PUBLIC_API_URL/)
  })

  it.each([undefined, 'staging', 'production'])('recusa EXPO_PUBLIC_AMBIENTE %p', (ambiente) => {
    expect(() =>
      resolver({ EXPO_PUBLIC_AMBIENTE: ambiente, EXPO_PUBLIC_API_URL: URL_HTTPS }),
    ).toThrow(/EXPO_PUBLIC_AMBIENTE.*development \| homologacao \| producao/s)
  })
})
