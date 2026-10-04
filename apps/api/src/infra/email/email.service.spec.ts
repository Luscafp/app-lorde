import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as Sentry from '@sentry/nestjs'
import { ConfiguracaoModule } from '../../config/config.module'
import { EmailProvider } from './email-provider'
import { EmailModule } from './email.module'
import { EmailService } from './email.service'
import { FakeEmailProvider } from './providers/fake-email.provider'

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }))

const mensagem = {
  para: 'ana@exemplo.com',
  assunto: 'Seu código — ATL',
  html: '<p>Código <strong>048213</strong></p>',
  texto: 'Código 048213',
}

describe('EmailService', () => {
  let servico: EmailService
  let fake: FakeEmailProvider
  let logErro: jest.SpyInstance

  beforeEach(async () => {
    // EMAIL_PROVIDER=fake vem de test/setup/env.ts.
    const modulo = await Test.createTestingModule({
      imports: [ConfiguracaoModule, EmailModule],
    }).compile()
    servico = modulo.get(EmailService)
    fake = modulo.get(EmailProvider)
    logErro = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    jest.mocked(Sentry.captureException).mockClear()
  })

  afterEach(() => logErro.mockRestore())

  it('com EMAIL_PROVIDER=fake injeta o FakeEmailProvider', () => {
    expect(fake).toBeInstanceOf(FakeEmailProvider)
  })

  it('entrega para, assunto, html e texto ao provider, com o remetente da env', async () => {
    await servico.enviar(mensagem)
    expect(fake.ultimos()).toEqual([{ ...mensagem, de: process.env.EMAIL_REMETENTE }])
  })

  describe('quando o provider falha', () => {
    const erro = new Error('Resend fora do ar')

    beforeEach(() => fake.simularFalha(erro))

    it('rejeita a promessa com o erro do provider', async () => {
      await expect(servico.enviar(mensagem)).rejects.toBe(erro)
    })

    it('loga com o e-mail mascarado e sem o conteúdo da mensagem', async () => {
      await servico.enviar(mensagem).catch(() => undefined)

      expect(logErro).toHaveBeenCalledTimes(1)
      const registro = JSON.stringify(logErro.mock.calls[0])
      expect(registro).toContain('a***@exemplo.com')
      expect(registro).not.toContain('ana@exemplo.com')
      expect(registro).not.toContain('048213')
      expect(registro).not.toContain(mensagem.assunto)
    })

    it('reporta ao Sentry com o e-mail mascarado', async () => {
      await servico.enviar(mensagem).catch(() => undefined)

      expect(Sentry.captureException).toHaveBeenCalledWith(erro, {
        tags: { modulo: 'email' },
        extra: { para: 'a***@exemplo.com' },
      })
    })
  })
})
