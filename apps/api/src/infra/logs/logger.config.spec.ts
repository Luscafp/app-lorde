import { CAMINHOS_REDIGIDOS, criarConfigLogger, nivelDoLog, ROTA_HEALTH } from './logger.config'

describe('nivelDoLog', () => {
  it.each([
    [200, '/api/v1/eventos/:id', 'info'],
    [204, undefined, 'info'],
    [200, ROTA_HEALTH, 'debug'],
    [400, '/api/v1/eventos/:id', 'warn'],
    [404, undefined, 'warn'],
    [429, undefined, 'warn'],
    [500, '/api/v1/eventos/:id', 'error'],
    [503, ROTA_HEALTH, 'error'],
  ])('%i em %s → %s', (status, rota, nivel) => {
    expect(nivelDoLog(status, rota)).toBe(nivel)
  })

  it('erro na resposta → error', () => {
    expect(nivelDoLog(200, undefined, new Error('x'))).toBe('error')
  })
})

describe('criarConfigLogger', () => {
  it('redige cabeçalhos e campos sensíveis em qualquer nível', () => {
    for (const caminho of [
      'req.headers.authorization',
      'senha',
      '*.senha',
      '*.email',
      '*.codigo',
    ]) {
      expect(CAMINHOS_REDIGIDOS).toContain(caminho)
    }
  })

  it('campos fixos service, env e version; JSON fora do desenvolvimento', () => {
    const params = criarConfigLogger({
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
      APP_ENV: 'producao',
    })
    expect(params.pinoHttp).toMatchObject({
      base: { service: 'api', env: 'producao', version: expect.stringMatching(/\+/) as string },
      redact: { censor: '[REDACTED]' },
    })
    expect(params.pinoHttp).not.toHaveProperty('transport')
  })
})
