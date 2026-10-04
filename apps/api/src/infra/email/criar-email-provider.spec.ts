import { criarEmailProvider } from './criar-email-provider'
import { FakeEmailProvider } from './providers/fake-email.provider'
import { LogEmailProvider } from './providers/log-email.provider'
import { ResendEmailProvider } from './providers/resend-email.provider'

jest.mock('resend')

describe('criarEmailProvider', () => {
  it.each([
    ['resend', ResendEmailProvider],
    ['fake', FakeEmailProvider],
    ['log', LogEmailProvider],
  ] as const)('EMAIL_PROVIDER=%s → %p', (EMAIL_PROVIDER, classe) => {
    const provider = criarEmailProvider({
      NODE_ENV: 'development',
      EMAIL_PROVIDER,
      RESEND_API_KEY: 're_chave',
    })
    expect(provider).toBeInstanceOf(classe)
  })
})
