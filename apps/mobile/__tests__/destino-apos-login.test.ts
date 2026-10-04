import {
  caminhoInterno,
  consumirDestinoAposLogin,
  guardarDestinoAposLogin,
} from '@/infra/sessao/destino'

describe('destino após o login', () => {
  afterEach(() => {
    consumirDestinoAposLogin()
  })

  it.each([
    ['atletica://eventos/1?aba=2', '/eventos/1?aba=2'],
    ['atletica:///agenda', '/agenda'],
    ['/painel', '/painel'],
  ])('%s → %s', (url, caminho) => {
    expect(caminhoInterno(url)).toBe(caminho)
  })

  it('guarda rota protegida e a entrega uma única vez', () => {
    guardarDestinoAposLogin('atletica://eventos/1')
    expect(consumirDestinoAposLogin()).toBe('/eventos/1')
    expect(consumirDestinoAposLogin()).toBeNull()
  })

  it.each(['atletica://login', 'atletica://cadastro', 'atletica:///', '/recuperar-senha/codigo'])(
    'não guarda rota pública (%s)',
    (url) => {
      guardarDestinoAposLogin(url)
      expect(consumirDestinoAposLogin()).toBeNull()
    },
  )

  it('ignora a URL de abertura do development build', () => {
    guardarDestinoAposLogin('atletica://expo-development-client/?url=http%3A%2F%2F10.0.0.2%3A8081')
    expect(consumirDestinoAposLogin()).toBeNull()
  })
})
