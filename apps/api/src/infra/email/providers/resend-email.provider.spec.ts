import { Resend } from 'resend'
import { ResendEmailProvider, TIMEOUT_RESEND_MS } from './resend-email.provider'

jest.mock('resend')

const mensagem = {
  de: 'Atlética <nao-responda@ex.com>',
  para: 'ana@ex.com',
  assunto: 'Assunto',
  html: '<p>Corpo</p>',
  texto: 'Corpo',
}

/** Substitui `emails.send` da instância criada pelo provider. */
function mockarEnvio(resposta: unknown): jest.Mock {
  const send = jest.fn().mockResolvedValue(resposta)
  jest.mocked(Resend).mockImplementation(() => ({ emails: { send } }) as unknown as Resend)
  return send
}

describe('ResendEmailProvider', () => {
  afterEach(() => jest.restoreAllMocks())

  it('cria o cliente com a chave e envia remetente, destinatário, assunto, html e texto', async () => {
    const send = mockarEnvio({ data: { id: 'email-1' }, error: null })
    await new ResendEmailProvider('re_chave').enviar(mensagem)

    expect(Resend).toHaveBeenCalledWith('re_chave')
    expect(send).toHaveBeenCalledWith(
      {
        from: mensagem.de,
        to: 'ana@ex.com',
        subject: 'Assunto',
        html: '<p>Corpo</p>',
        text: 'Corpo',
      },
      { signal: expect.any(AbortSignal) as AbortSignal },
    )
  })

  it(`aborta a requisição após ${TIMEOUT_RESEND_MS} ms`, async () => {
    const timeout = jest.spyOn(AbortSignal, 'timeout')
    mockarEnvio({ data: { id: 'email-1' }, error: null })
    await new ResendEmailProvider('re_chave').enviar(mensagem)
    expect(timeout).toHaveBeenCalledWith(10_000)
  })

  it('rejeita quando o Resend devolve erro', async () => {
    mockarEnvio({
      data: null,
      error: { name: 'validation_error', message: 'Domínio não verificado' },
    })
    await expect(new ResendEmailProvider('re_chave').enviar(mensagem)).rejects.toThrow(
      /validation_error.*Domínio não verificado/,
    )
  })

  it('propaga o erro de timeout/rede', async () => {
    const send = jest.fn().mockRejectedValue(new DOMException('tempo esgotado', 'TimeoutError'))
    jest.mocked(Resend).mockImplementation(() => ({ emails: { send } }) as unknown as Resend)
    await expect(new ResendEmailProvider('re_chave').enviar(mensagem)).rejects.toThrow(
      'tempo esgotado',
    )
  })
})
