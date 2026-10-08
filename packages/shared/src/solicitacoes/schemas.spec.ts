import { listarSolicitacoesQuerySchema } from './schemas'

describe('listarSolicitacoesQuerySchema', () => {
  it('sem status: só pendentes, paginação padrão', () => {
    expect(listarSolicitacoesQuerySchema.parse({})).toEqual({
      status: ['PENDENTE'],
      page: 1,
      limit: 20,
    })
  })

  it('status repetível: um valor vira lista; repetidos são removidos', () => {
    expect(listarSolicitacoesQuerySchema.parse({ status: 'REJEITADA' }).status).toEqual([
      'REJEITADA',
    ])
    expect(
      listarSolicitacoesQuerySchema.parse({ status: ['APROVADA', 'CANCELADA', 'APROVADA'] }).status,
    ).toEqual(['APROVADA', 'CANCELADA'])
  })

  it.each([{ status: 'OUTRO' }, { status: [] }, { timeId: 'abc' }, { extra: '1' }])(
    'rejeita %j',
    (query) => {
      expect(listarSolicitacoesQuerySchema.safeParse(query).success).toBe(false)
    },
  )
})
