import { rotaNotificacao, rotaNotificacaoPermitida, type DestinoNotificacao } from './rotas'

const ID = '0f8b2c4e-1a3d-4e5f-9a7b-6c5d4e3f2a1b'

describe('rotaNotificacao', () => {
  it.each<[DestinoNotificacao, string]>([
    [{ tela: 'inicio' }, '/'],
    [{ tela: 'evento', id: ID }, `/eventos/${ID}`],
    [{ tela: 'noticia', id: ID }, `/noticias/${ID}`],
    [{ tela: 'time', id: ID }, `/times/${ID}`],
    [{ tela: 'solicitacoes' }, '/painel/solicitacoes'],
    [{ tela: 'perfil' }, '/perfil'],
  ])('%o → %s', (destino, url) => {
    expect(rotaNotificacao(destino)).toBe(url)
  })

  it('lança com id fora do formato', () => {
    expect(() => rotaNotificacao({ tela: 'evento', id: '../painel' })).toThrow()
  })
})

describe('rotaNotificacaoPermitida', () => {
  it.each([
    '/',
    `/eventos/${ID}`,
    `/noticias/${ID}`,
    `/times/${ID}`,
    '/painel/solicitacoes',
    '/perfil',
  ])('aceita %s', (url) => {
    expect(rotaNotificacaoPermitida(url)).toBe(true)
  })

  it.each([
    '',
    '/painel',
    '/painel/usuarios',
    `/eventos/${ID}/editar`,
    '/eventos/123',
    `https://exemplo.com/eventos/${ID}`,
    '//exemplo.com',
    '/perfil?x=1',
    null,
    42,
  ])('rejeita %p', (url) => {
    expect(rotaNotificacaoPermitida(url)).toBe(false)
  })
})
