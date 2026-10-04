import { mascararEmail } from './mascarar-email'

describe('mascararEmail', () => {
  it.each([
    ['ana@ex.com', 'a***@ex.com'],
    ['Joao.Silva@universidade.edu.br', 'J***@universidade.edu.br'],
    ['a@ex.com', 'a***@ex.com'],
    ['sem-arroba', '***'],
    ['@ex.com', '***'],
    ['', '***'],
  ])('%p → %p', (email, esperado) => {
    expect(mascararEmail(email)).toBe(esperado)
  })
})
