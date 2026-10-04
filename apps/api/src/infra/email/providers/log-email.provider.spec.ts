import { Logger } from '@nestjs/common'
import { LogEmailProvider } from './log-email.provider'

const mensagem = {
  de: 'Remetente <r@ex.com>',
  para: 'ana@ex.com',
  assunto: 'Seu código',
  html: '<p>Código 048213</p>',
  texto: 'Código 048213',
}

describe('LogEmailProvider', () => {
  let log: jest.SpyInstance

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => log.mockRestore())

  it('em development loga destinatário e corpo em texto (nível info)', async () => {
    await new LogEmailProvider(true).enviar(mensagem)
    expect(log).toHaveBeenCalledWith(
      { de: mensagem.de, para: 'ana@ex.com', assunto: 'Seu código', texto: 'Código 048213' },
      expect.any(String),
    )
  })

  it('fora de development não loga o corpo nem o e-mail completo', async () => {
    await new LogEmailProvider(false).enviar(mensagem)
    const registro = JSON.stringify(log.mock.calls)
    expect(registro).not.toContain('048213')
    expect(registro).not.toContain('ana@ex.com')
    expect(registro).toContain('a***@ex.com')
  })
})
