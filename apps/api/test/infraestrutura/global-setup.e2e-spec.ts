import * as childProcess from 'node:child_process'
import globalSetup, { ErroBancoDeTeste, garantirBancoDeTeste } from '../setup/global-setup'

describe('globalSetup dos testes de integração (#42)', () => {
  const urlOriginal = process.env.DATABASE_URL

  afterEach(() => {
    process.env.DATABASE_URL = urlOriginal
    jest.restoreAllMocks()
  })

  it('com DATABASE_URL de atletica_dev, aborta sem aplicar migrations', () => {
    const exec = jest.spyOn(childProcess, 'execFileSync')
    process.env.DATABASE_URL = 'postgresql://atletica:segredo@localhost:5432/atletica_dev'

    expect(() => globalSetup()).toThrow(ErroBancoDeTeste)
    expect(() => globalSetup()).toThrow(/"atletica_dev" não termina em "_test"/)
    expect(exec).not.toHaveBeenCalled()
  })

  it('a mensagem não expõe a senha da URL', () => {
    expect(() =>
      garantirBancoDeTeste('postgresql://atletica:segredo@localhost:5432/atletica_dev'),
    ).toThrow(/^(?!.*segredo)/s)
  })

  it.each([
    [undefined, /não definida/],
    ['nao-e-url', /inválida/],
    ['postgresql://u:s@localhost:5432/atletica', /"atletica" não termina/],
  ])('recusa %p', (url, mensagem) => {
    expect(() => garantirBancoDeTeste(url)).toThrow(mensagem)
  })

  it('aceita banco terminado em _test', () => {
    expect(garantirBancoDeTeste('postgresql://u:s@localhost:5433/atletica_test')).toBe(
      'atletica_test',
    )
  })
})
