import { responderParticipacaoSchema } from './schemas'

describe('responderParticipacaoSchema', () => {
  it.each([true, false])('aceita confirmado = %s', (confirmado) => {
    expect(responderParticipacaoSchema.parse({ confirmado })).toEqual({ confirmado })
  })

  it.each([
    ['vazio', {}],
    ['texto', { confirmado: 'sim' }],
    ['nulo', { confirmado: null }],
    ['campo extra', { confirmado: true, usuarioId: 'b1b1b1b1-0000-4000-8000-000000000001' }],
  ])('rejeita corpo %s', (_, corpo) => {
    expect(responderParticipacaoSchema.safeParse(corpo).success).toBe(false)
  })
})
