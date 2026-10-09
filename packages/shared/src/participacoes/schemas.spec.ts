import { registrarPresencasSchema, responderParticipacaoSchema } from './schemas'

const ID = (n: number) => `b1b1b1b1-0000-4000-8000-${String(n).padStart(12, '0')}`

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

describe('registrarPresencasSchema', () => {
  it.each([
    ['vazia', []],
    ['com ids', [ID(1), ID(2)]],
    ['no limite de 200', Array.from({ length: 200 }, (_, i) => ID(i))],
  ])('aceita lista %s', (_, presentes) => {
    expect(registrarPresencasSchema.parse({ presentes })).toEqual({ presentes })
  })

  it.each([
    ['sem presentes', {}],
    ['id inválido', { presentes: ['abc'] }],
    ['acima de 200', { presentes: Array.from({ length: 201 }, (_, i) => ID(i)) }],
    ['campo extra', { presentes: [], eventoId: ID(1) }],
  ])('rejeita corpo %s', (_, corpo) => {
    expect(registrarPresencasSchema.safeParse(corpo).success).toBe(false)
  })

  it('rejeita ids repetidos apontando o campo presentes', () => {
    const resultado = registrarPresencasSchema.safeParse({ presentes: [ID(1), ID(1)] })
    expect(resultado.error?.issues).toEqual([
      expect.objectContaining({ path: ['presentes'], message: 'Atleta repetido.' }),
    ])
  })
})
