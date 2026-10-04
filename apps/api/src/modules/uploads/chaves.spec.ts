import { gerarChave, lerChave } from './chaves'

const usuarioId = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const atleticaId = '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11'
const uuid = '3e7d9c1b-5a4f-4e2d-8b6a-9c0d1e2f3a4b'
const dono = { usuarioId, atleticaId }

describe('gerarChave', () => {
  it('PERFIL sem a atlética', () => {
    expect(gerarChave('PERFIL', 'image/jpeg', dono, uuid)).toBe(
      `usuarios/${usuarioId}/perfil/${uuid}.jpg`,
    )
  })

  it('NOTICIA e BANNER na pasta da atlética, com o autor', () => {
    expect(gerarChave('NOTICIA', 'image/jpeg', dono, uuid)).toBe(
      `atleticas/${atleticaId}/noticias/${usuarioId}/${uuid}.jpg`,
    )
    expect(gerarChave('BANNER', 'image/jpeg', dono, uuid)).toBe(
      `atleticas/${atleticaId}/banners/${usuarioId}/${uuid}.jpg`,
    )
  })

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ] as const)('%s → .%s', (contentType, extensao) => {
    expect(gerarChave('PERFIL', contentType, dono, uuid)).toMatch(new RegExp(`\\.${extensao}$`))
  })

  it('gera um UUID novo a cada chave', () => {
    const primeira = gerarChave('PERFIL', 'image/png', dono)
    expect(primeira).toMatch(/^usuarios\/[^/]+\/perfil\/[0-9a-f-]{36}\.png$/)
    expect(gerarChave('PERFIL', 'image/png', dono)).not.toBe(primeira)
  })
})

describe('lerChave', () => {
  it.each(['PERFIL', 'NOTICIA', 'BANNER'] as const)('lê o dono da chave gerada (%s)', (fin) => {
    const esperado = fin === 'PERFIL' ? { usuarioId, atleticaId: undefined } : dono
    expect(lerChave(gerarChave(fin, 'image/webp', dono, uuid), fin)).toEqual(esperado)
  })

  it('rejeita a chave de outra finalidade', () => {
    const noticia = gerarChave('NOTICIA', 'image/jpeg', dono, uuid)
    expect(lerChave(noticia, 'BANNER')).toBeNull()
    expect(lerChave(noticia, 'PERFIL')).toBeNull()
    expect(lerChave(gerarChave('PERFIL', 'image/jpeg', dono, uuid), 'NOTICIA')).toBeNull()
  })

  it.each([
    ['..', `usuarios/${usuarioId}/perfil/../${uuid}.jpg`],
    ['../ no início', `../usuarios/${usuarioId}/perfil/${uuid}.jpg`],
    ['barra dupla', `usuarios/${usuarioId}//perfil/${uuid}.jpg`],
    ['barra inicial', `/usuarios/${usuarioId}/perfil/${uuid}.jpg`],
    ['segmento a mais', `usuarios/${usuarioId}/perfil/x/${uuid}.jpg`],
    ['extensão não permitida', `usuarios/${usuarioId}/perfil/${uuid}.html`],
    ['nome que não é UUID', `usuarios/${usuarioId}/perfil/foto.jpg`],
    ['usuário que não é UUID', `usuarios/admin/perfil/${uuid}.jpg`],
    ['maiúsculas', `usuarios/${usuarioId.toUpperCase()}/perfil/${uuid}.jpg`],
    ['quebra de linha', `usuarios/${usuarioId}/perfil/${uuid}.jpg\n`],
  ])('rejeita %s', (_caso, key) => {
    expect(lerChave(key, 'PERFIL')).toBeNull()
  })

  const pastas = [
    ['NOTICIA', 'noticias'],
    ['BANNER', 'banners'],
  ] as const
  const base = (pasta: string) => `atleticas/${atleticaId}/${pasta}/${usuarioId}`

  it.each(
    pastas.flatMap(([fin, pasta]) => [
      [fin, '..', `${base(pasta)}/../${uuid}.jpg`],
      [fin, 'barra dupla', `atleticas/${atleticaId}//${pasta}/${usuarioId}/${uuid}.jpg`],
      [fin, 'barra inicial', `/${base(pasta)}/${uuid}.jpg`],
      [fin, 'segmento a mais', `${base(pasta)}/x/${uuid}.jpg`],
      [fin, 'sem o autor', `atleticas/${atleticaId}/${pasta}/${uuid}.jpg`],
      [fin, 'atlética que não é UUID', `atleticas/lorde/${pasta}/${usuarioId}/${uuid}.jpg`],
      [fin, 'extensão não permitida', `${base(pasta)}/${uuid}.html`],
      [fin, 'maiúsculas', `${base(pasta).toUpperCase()}/${uuid}.jpg`],
    ]),
  )('%s rejeita %s', (fin, _caso, key) => {
    expect(lerChave(key, fin)).toBeNull()
  })
})
