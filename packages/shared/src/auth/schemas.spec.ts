import { senhaSchema } from './schemas'

describe('senhaSchema', () => {
  it.each(['lorde2026', 'Árvore123', 'a1234567', 'x'.repeat(127) + '1'])('aceita %s', (senha) => {
    expect(senhaSchema.safeParse(senha).success).toBe(true)
  })

  it.each([
    ['sem número', 'abcdefgh', 'A senha deve ter ao menos um número.'],
    ['sem letra', '12345678', 'A senha deve ter ao menos uma letra.'],
    ['7 caracteres', 'abc1234', 'A senha deve ter ao menos 8 caracteres.'],
    ['129 caracteres', 'a'.repeat(128) + '1', 'A senha deve ter no máximo 128 caracteres.'],
  ])('rejeita senha %s', (_caso, senha, mensagem) => {
    const resultado = senhaSchema.safeParse(senha)
    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues.map(({ message }) => message)).toContain(mensagem)
  })
})
