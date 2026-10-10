import { ErroConfiguracao, validarEnv } from './env.schema'

const valida = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://atletica:segredo@localhost:5432/atletica_dev',
  EMAIL_PROVIDER: 'log',
  EMAIL_REMETENTE: 'Atlética <nao-responda@exemplo.com.br>',
  CODIGO_PEPPER: 'p'.repeat(32),
  JWT_ACCESS_SECRET: 'j'.repeat(32),
  R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  R2_ACCESS_KEY_ID: 'chave-de-acesso',
  R2_SECRET_ACCESS_KEY: 'segredo-de-acesso',
  R2_BUCKET_IMAGENS: 'atletica-imagens-dev',
  R2_PUBLIC_BASE_URL: 'https://imagens.exemplo.com',
}

const producao = {
  ...valida,
  NODE_ENV: 'production',
  APP_ENV: 'producao',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_chave',
  EXPO_ACCESS_TOKEN: 'expo-token',
}

describe('validarEnv', () => {
  it('aceita configuração válida e aplica padrões', () => {
    expect(validarEnv(valida)).toEqual({
      NODE_ENV: 'development',
      APP_ENV: 'local',
      PORT: 3000,
      DATABASE_URL: valida.DATABASE_URL,
      LOG_LEVEL: 'info',
      EMAIL_PROVIDER: 'log',
      EMAIL_REMETENTE: valida.EMAIL_REMETENTE,
      CODIGO_PEPPER: valida.CODIGO_PEPPER,
      JWT_ACCESS_SECRET: valida.JWT_ACCESS_SECRET,
      R2_ACCOUNT_ID: valida.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: valida.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: valida.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_IMAGENS: valida.R2_BUCKET_IMAGENS,
      R2_PUBLIC_BASE_URL: valida.R2_PUBLIC_BASE_URL,
      SENTRY_TRACES_SAMPLE_RATE: 0.1,
      FILA_WORKERS_ATIVOS: true,
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
    const { APP_ENV: _, ...semAppEnv } = producao
    expect(() => validarEnv(semAppEnv)).toThrow(/APP_ENV/)
  })

  it('rejeita NODE_ENV=production com APP_ENV local ou development', () => {
    for (const APP_ENV of ['local', 'development']) {
      expect(() => validarEnv({ ...producao, APP_ENV })).toThrow(/APP_ENV/)
    }
  })

  it('aceita NODE_ENV=production com APP_ENV homologacao ou producao', () => {
    for (const APP_ENV of ['homologacao', 'producao'] as const) {
      expect(validarEnv({ ...producao, APP_ENV }).APP_ENV).toBe(APP_ENV)
    }
  })

  it('rejeita APP_ENV desconhecido', () => {
    expect(() => validarEnv({ ...valida, APP_ENV: 'staging' })).toThrow(/APP_ENV/)
  })

  describe('e-mail (#61)', () => {
    it.each(['resend', 'fake', 'log'])('aceita EMAIL_PROVIDER=%s', (EMAIL_PROVIDER) => {
      const env = validarEnv({ ...valida, EMAIL_PROVIDER, RESEND_API_KEY: 're_chave' })
      expect(env.EMAIL_PROVIDER).toBe(EMAIL_PROVIDER)
    })

    it('rejeita EMAIL_PROVIDER ausente ou desconhecido', () => {
      const { EMAIL_PROVIDER: _, ...semProvider } = valida
      expect(() => validarEnv(semProvider)).toThrow(/EMAIL_PROVIDER/)
      expect(() => validarEnv({ ...valida, EMAIL_PROVIDER: 'smtp' })).toThrow(/EMAIL_PROVIDER/)
    })

    it('rejeita EMAIL_PROVIDER=resend sem RESEND_API_KEY, com mensagem clara', () => {
      const config = { ...valida, EMAIL_PROVIDER: 'resend' }
      expect(() => validarEnv(config)).toThrow(
        /RESEND_API_KEY: obrigatória com EMAIL_PROVIDER=resend/,
      )
      for (const RESEND_API_KEY of ['', '  ']) {
        expect(() => validarEnv({ ...config, RESEND_API_KEY })).toThrow(
          /RESEND_API_KEY: obrigatória com EMAIL_PROVIDER=resend/,
        )
      }
    })

    it('aceita RESEND_API_KEY vazia (como no .env.example) fora do resend', () => {
      for (const EMAIL_PROVIDER of ['fake', 'log']) {
        const env = validarEnv({ ...valida, EMAIL_PROVIDER, RESEND_API_KEY: '' })
        expect(env.RESEND_API_KEY).toBeUndefined()
      }
    })

    it('exige EMAIL_PROVIDER=resend com NODE_ENV=production', () => {
      for (const EMAIL_PROVIDER of ['fake', 'log']) {
        expect(() => validarEnv({ ...producao, EMAIL_PROVIDER })).toThrow(/EMAIL_PROVIDER/)
      }
      expect(validarEnv(producao).EMAIL_PROVIDER).toBe('resend')
    })

    it('rejeita EMAIL_REMETENTE ausente', () => {
      const { EMAIL_REMETENTE: _, ...semRemetente } = valida
      expect(() => validarEnv(semRemetente)).toThrow(/EMAIL_REMETENTE/)
    })

    it('rejeita CODIGO_PEPPER ausente ou com menos de 32 caracteres, sem imprimir o valor', () => {
      const { CODIGO_PEPPER: _, ...semPepper } = valida
      expect(() => validarEnv(semPepper)).toThrow(/CODIGO_PEPPER/)
      const curto = { ...valida, CODIGO_PEPPER: 'segredo-curto-31-caracteres-xxx' }
      expect(() => validarEnv(curto)).toThrow(/CODIGO_PEPPER: obrigatória, com ao menos 32/)
      expect(() => validarEnv(curto)).not.toThrow(/segredo-curto/)
    })

    it('rejeita JWT_ACCESS_SECRET ausente ou com menos de 32 caracteres, sem imprimir o valor', () => {
      const { JWT_ACCESS_SECRET: _, ...semSegredo } = valida
      expect(() => validarEnv(semSegredo)).toThrow(/JWT_ACCESS_SECRET/)
      const curto = { ...valida, JWT_ACCESS_SECRET: 'segredo-curto-31-caracteres-xxx' }
      expect(() => validarEnv(curto)).toThrow(/JWT_ACCESS_SECRET: obrigatória, com ao menos 32/)
      expect(() => validarEnv(curto)).not.toThrow(/segredo-curto/)
    })
  })

  describe('R2 (#54)', () => {
    it.each([
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_IMAGENS',
      'R2_PUBLIC_BASE_URL',
    ] as const)('rejeita %s ausente ou vazia', (variavel) => {
      const { [variavel]: _, ...sem } = valida
      expect(() => validarEnv(sem)).toThrow(new RegExp(variavel))
      expect(() => validarEnv({ ...valida, [variavel]: '' })).toThrow(new RegExp(variavel))
    })

    it('R2_ACCOUNT_ID tem 32 caracteres hexadecimais', () => {
      expect(() => validarEnv({ ...valida, R2_ACCOUNT_ID: 'conta.exemplo.com' })).toThrow(
        /R2_ACCOUNT_ID/,
      )
    })

    it('R2_PUBLIC_BASE_URL exige https e não aceita barra final', () => {
      for (const R2_PUBLIC_BASE_URL of [
        'cdn',
        'http://imagens.exemplo.com',
        'https://img.ex.com/',
      ]) {
        expect(() => validarEnv({ ...valida, R2_PUBLIC_BASE_URL })).toThrow(/R2_PUBLIC_BASE_URL/)
      }
    })

    it('não imprime o segredo', () => {
      const config = { ...valida, R2_SECRET_ACCESS_KEY: 'valor-secreto', R2_PUBLIC_BASE_URL: '' }
      expect(() => validarEnv(config)).not.toThrow(/valor-secreto/)
    })
  })

  describe('Sentry (#48)', () => {
    it('SENTRY_DSN é opcional e vazia conta como ausente', () => {
      expect(validarEnv(valida).SENTRY_DSN).toBeUndefined()
      expect(validarEnv({ ...valida, SENTRY_DSN: '' }).SENTRY_DSN).toBeUndefined()
    })

    it('aceita SENTRY_DSN com URL e rejeita outro valor', () => {
      const dsn = 'https://chave@o1.ingest.sentry.io/1'
      expect(validarEnv({ ...valida, SENTRY_DSN: dsn }).SENTRY_DSN).toBe(dsn)
      expect(() => validarEnv({ ...valida, SENTRY_DSN: 'nao-e-url' })).toThrow(/SENTRY_DSN/)
    })

    it('SENTRY_TRACES_SAMPLE_RATE de 0 a 1, padrão 0.1', () => {
      const taxa = (valor: string) => validarEnv({ ...valida, SENTRY_TRACES_SAMPLE_RATE: valor })
      expect(taxa('').SENTRY_TRACES_SAMPLE_RATE).toBe(0.1)
      expect(taxa('1').SENTRY_TRACES_SAMPLE_RATE).toBe(1)
      for (const invalido of ['1.5', '-0.1', 'abc']) {
        expect(() => taxa(invalido)).toThrow(/SENTRY_TRACES_SAMPLE_RATE/)
      }
    })
  })

  describe('fila (#86)', () => {
    it('FILA_WORKERS_ATIVOS aceita true ou false, padrão true', () => {
      const workers = (valor: string) => validarEnv({ ...valida, FILA_WORKERS_ATIVOS: valor })
      expect(workers('').FILA_WORKERS_ATIVOS).toBe(true)
      expect(workers('true').FILA_WORKERS_ATIVOS).toBe(true)
      expect(workers('false').FILA_WORKERS_ATIVOS).toBe(false)
      expect(() => workers('0')).toThrow(/FILA_WORKERS_ATIVOS/)
    })
  })

  describe('push (#87)', () => {
    it('EXPO_ACCESS_TOKEN é opcional fora de produção e vazia conta como ausente', () => {
      expect(validarEnv(valida).EXPO_ACCESS_TOKEN).toBeUndefined()
      expect(validarEnv({ ...valida, EXPO_ACCESS_TOKEN: '' }).EXPO_ACCESS_TOKEN).toBeUndefined()
      const homologacao = { ...producao, APP_ENV: 'homologacao', EXPO_ACCESS_TOKEN: '' }
      expect(validarEnv(homologacao).EXPO_ACCESS_TOKEN).toBeUndefined()
    })

    it('EXPO_ACCESS_TOKEN é obrigatória com APP_ENV=producao', () => {
      expect(validarEnv(producao).EXPO_ACCESS_TOKEN).toBe('expo-token')
      const { EXPO_ACCESS_TOKEN: _, ...semToken } = producao
      expect(() => validarEnv(semToken)).toThrow(/EXPO_ACCESS_TOKEN/)
    })
  })
})
