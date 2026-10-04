import { commitApi, versaoApi, VERSAO_API } from './versao'

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

describe('commitApi', () => {
  it('7 primeiros caracteres do GIT_COMMIT_SHA', () => {
    expect(commitApi({ GIT_COMMIT_SHA: SHA, RAILWAY_GIT_COMMIT_SHA: 'f'.repeat(40) })).toBe(
      'a1b2c3d',
    )
  })

  it('RAILWAY_GIT_COMMIT_SHA sem GIT_COMMIT_SHA', () => {
    expect(commitApi({ RAILWAY_GIT_COMMIT_SHA: SHA })).toBe('a1b2c3d')
  })

  it('"desconhecido" sem nenhuma das duas', () => {
    expect(commitApi({})).toBe('desconhecido')
  })
})

describe('versaoApi', () => {
  it('<versao>+<commit>', () => {
    expect(versaoApi({ GIT_COMMIT_SHA: SHA })).toBe(`${VERSAO_API}+a1b2c3d`)
  })
})
