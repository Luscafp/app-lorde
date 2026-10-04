import type { Env } from '../../config/env.schema'
import type { EmailProvider } from './email-provider'
import { FakeEmailProvider } from './providers/fake-email.provider'
import { LogEmailProvider } from './providers/log-email.provider'
import { ResendEmailProvider } from './providers/resend-email.provider'

type ConfigEmail = Pick<Env, 'NODE_ENV' | 'EMAIL_PROVIDER' | 'RESEND_API_KEY'>

/** Escolhe o provider por `EMAIL_PROVIDER`; a env já foi validada (`RESEND_API_KEY` presente). */
export function criarEmailProvider(env: ConfigEmail): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case 'resend':
      return new ResendEmailProvider(env.RESEND_API_KEY ?? '')
    case 'fake':
      return new FakeEmailProvider()
    case 'log':
      return new LogEmailProvider(env.NODE_ENV === 'development')
  }
}
