/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'

type Perfil = {
  extends?: string
  developmentClient?: boolean
  distribution?: string
  channel?: string
  autoIncrement?: boolean
  android?: { buildType?: string }
  env?: Record<string, string>
}
type EasJson = { cli: { appVersionSource: string }; build: Record<string, Perfil> }

const texto = fs.readFileSync(path.resolve(__dirname, '../eas.json'), 'utf8')
const eas = JSON.parse(texto) as EasJson

/** Aplica o `extends` como o EAS: herda o perfil base, sobrescrevendo `env` e `android` por chave. */
function perfil(nome: string): Perfil {
  const { extends: base, ...proprio } = eas.build[nome] ?? {}
  if (!base) return proprio
  const herdado = perfil(base)
  return {
    ...herdado,
    ...proprio,
    env: { ...herdado.env, ...proprio.env },
    android: { ...herdado.android, ...proprio.android },
  }
}

describe('eas.json', () => {
  it('versionCode remoto', () => {
    expect(eas.cli.appVersionSource).toBe('remote')
  })

  it.each([
    ['development', 'apk', 'internal', 'development', 'development'],
    ['preview', 'apk', 'internal', 'homologacao', 'homologacao'],
    ['production', 'app-bundle', 'store', 'producao', 'producao'],
    ['production-apk', 'apk', 'internal', 'producao', 'producao'],
  ])('%s: %s, %s, canal %s, ambiente %s', (nome, buildType, distribution, channel, ambiente) => {
    const resolvido = perfil(nome)

    expect(resolvido).toEqual(
      expect.objectContaining({ distribution, channel, android: { buildType } }),
    )
    expect(resolvido.env?.EXPO_PUBLIC_AMBIENTE).toBe(ambiente)
    expect(resolvido.env).toHaveProperty('EXPO_PUBLIC_API_URL')
    expect(resolvido.env).toHaveProperty('EXPO_PUBLIC_SENTRY_DSN')
  })

  it('dev client só no perfil development', () => {
    expect(perfil('development').developmentClient).toBe(true)
    for (const nome of ['preview', 'production', 'production-apk']) {
      expect(perfil(nome).developmentClient).toBeUndefined()
    }
  })

  it('versionCode incrementado nos builds de produção', () => {
    expect(perfil('production').autoIncrement).toBe(true)
    expect(perfil('production-apk').autoIncrement).toBe(true)
  })

  it('URL https:// fora de development', () => {
    for (const nome of ['preview', 'production', 'production-apk']) {
      expect(perfil(nome).env?.EXPO_PUBLIC_API_URL).toMatch(/^https:\/\//)
    }
  })

  it('nenhum segredo no arquivo', () => {
    expect(texto).not.toMatch(
      /SENTRY_AUTH_TOKEN|EXPO_TOKEN|KEYSTORE|PASSWORD|SENHA|SECRET|serviceAccount|sntrys_/i,
    )
  })
})
