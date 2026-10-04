import { FakeEmailProvider } from './fake-email.provider'

const mensagem = {
  de: 'Remetente <r@ex.com>',
  para: 'ana@ex.com',
  assunto: 'A',
  html: '<p>B</p>',
  texto: 'B',
}

describe('FakeEmailProvider', () => {
  it('guarda as mensagens em ordem de envio', async () => {
    const fake = new FakeEmailProvider()
    await fake.enviar(mensagem)
    await fake.enviar({ ...mensagem, para: 'bia@ex.com' })
    expect(fake.ultimos().map((m) => m.para)).toEqual(['ana@ex.com', 'bia@ex.com'])
  })

  it('devolve cópias: alterar o retorno não afeta o que foi guardado', async () => {
    const fake = new FakeEmailProvider()
    await fake.enviar(mensagem)
    fake.ultimos().pop()
    expect(fake.ultimos()).toHaveLength(1)
  })

  it('simularFalha rejeita os envios e limpar volta ao normal', async () => {
    const fake = new FakeEmailProvider()
    const erro = new Error('falhou')
    fake.simularFalha(erro)
    await expect(fake.enviar(mensagem)).rejects.toBe(erro)
    expect(fake.ultimos()).toEqual([])

    fake.limpar()
    await fake.enviar(mensagem)
    expect(fake.ultimos()).toHaveLength(1)
  })

  it('limpar descarta as mensagens', async () => {
    const fake = new FakeEmailProvider()
    await fake.enviar(mensagem)
    fake.limpar()
    expect(fake.ultimos()).toEqual([])
  })
})
