import { SenhaService } from './senha.service'

/** Critério 17 do épico #3. */
describe('SenhaService', () => {
  const servico = new SenhaService()

  it('gera hash Argon2id com os parâmetros da convenção §5', async () => {
    const senhaHash = await servico.hash('lorde2026')
    expect(senhaHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
  })

  it('verifica a mesma senha e rejeita outra', async () => {
    const senhaHash = await servico.hash('lorde2026')
    await expect(servico.verificar(senhaHash, 'lorde2026')).resolves.toBe(true)
    await expect(servico.verificar(senhaHash, 'lorde2027')).resolves.toBe(false)
  })

  it('usa salt aleatório: a mesma senha gera hashes diferentes', async () => {
    const [a, b] = await Promise.all([servico.hash('lorde2026'), servico.hash('lorde2026')])
    expect(a).not.toBe(b)
  })

  it('hash malformado → false', async () => {
    await expect(servico.verificar('nao-e-um-hash', 'lorde2026')).resolves.toBe(false)
  })

  describe('precisaRefazerHash', () => {
    it('hash com os parâmetros atuais → false', async () => {
      expect(servico.precisaRefazerHash(await servico.hash('lorde2026'))).toBe(false)
    })

    it.each([
      ['memória menor', '$argon2id$v=19$m=4096,t=2,p=1$c2FsdHNhbHQ$aGFzaA'],
      ['tempo menor', '$argon2id$v=19$m=19456,t=1,p=1$c2FsdHNhbHQ$aGFzaA'],
      ['argon2i', '$argon2i$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$aGFzaA'],
      ['outra versão', '$argon2id$v=16$m=19456,t=2,p=1$c2FsdHNhbHQ$aGFzaA'],
      ['malformado', 'nao-e-um-hash'],
    ])('%s → true', (_caso, senhaHash) => {
      expect(servico.precisaRefazerHash(senhaHash)).toBe(true)
    })
  })
})
