import { idParamSchema } from './params'

describe('idParamSchema', () => {
  it('exige UUID', () => {
    expect(idParamSchema.safeParse({ id: 'abc' }).success).toBe(false)
    expect(idParamSchema.safeParse({ id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11' }).success).toBe(
      true,
    )
  })
})
