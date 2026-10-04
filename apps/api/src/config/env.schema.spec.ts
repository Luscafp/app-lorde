import { ErroConfiguracao, validarEnv } from './env.schema'

const valida = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://atletica:segredo@localhost:5432/atletica_dev',
}

describe('validarEnv', () => {
  it('aceita configuração válida e aplica padrões', () => {
    expect(validarEnv(valida)).toEqual({
      NODE_ENV: 'development',
      APP_ENV: 'local',
      PORT: 3000,
      DATABASE_URL: valida.DATABASE_URL,
      LOG_LEVEL: 'info',
    })
  })

  it('converte PORT numérica em string', () => {
    expect(validarEnv({ ...valida, PORT: '8080' }).PORT).toBe(8080)
  })

  it('rejeita DATABASE_URL ausente citando a variável sem imprimir valores', () => {
    const { DATABASE_URL: _, ...semUrl } = valida
    const config = { ...semUrl, OUTRA: 'valor-secreto' }
    expect(() => validarEnv(config)).toThrow(ErroConfiguracao)
    expect(() => validarEnv(config)).toThrow(/DATABASE_URL/)
    expect(() => validarEnv(config)).not.toThrow(/valor-secreto|development/)
  })

  it('rejeita DATABASE_URL que não é postgresql://', () => {
    expect(() => validarEnv({ ...valida, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    )
  })

  it('rejeita PORT não numérico', () => {
    expect(() => validarEnv({ ...valida, PORT: 'abc' })).toThrow(/PORT/)
  })

  it('rejeita NODE_ENV=production sem APP_ENV', () => {
    expect(() => validarEnv({ ...valida, NODE_ENV: 'production' })).toThrow(/APP_ENV/)
  })

  it('rejeita NODE_ENV=production com APP_ENV local ou development', () => {
    for (const APP_ENV of ['local', 'development']) {
      expect(() => validarEnv({ ...valida, NODE_ENV: 'production', APP_ENV })).toThrow(/APP_ENV/)
    }
  })

  it('aceita NODE_ENV=production com APP_ENV homologacao ou producao', () => {
    for (const APP_ENV of ['homologacao', 'producao'] as const) {
      expect(validarEnv({ ...valida, NODE_ENV: 'production', APP_ENV }).APP_ENV).toBe(APP_ENV)
    }
  })

  it('rejeita APP_ENV desconhecido', () => {
    expect(() => validarEnv({ ...valida, APP_ENV: 'staging' })).toThrow(/APP_ENV/)
  })
})
