import { paginacaoQuerySchema } from './paginacao'

describe('paginacaoQuerySchema', () => {
  it('aplica os padrões page=1 e limit=20', () => {
    expect(paginacaoQuerySchema.parse({})).toEqual({ page: 1, limit: 20 })
  })

  it('converte strings numéricas', () => {
    expect(paginacaoQuerySchema.parse({ page: '3', limit: '50' })).toEqual({ page: 3, limit: 50 })
  })

  it('rejeita limit=51', () => {
    expect(paginacaoQuerySchema.safeParse({ limit: 51 }).success).toBe(false)
  })

  it('rejeita page=0', () => {
    expect(paginacaoQuerySchema.safeParse({ page: 0 }).success).toBe(false)
  })

  it('rejeita campos desconhecidos', () => {
    expect(paginacaoQuerySchema.safeParse({ pagina: 1 }).success).toBe(false)
  })
})
