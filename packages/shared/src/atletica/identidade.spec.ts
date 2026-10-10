import { siglaOuNome } from './identidade'

describe('siglaOuNome', () => {
  it('usa a sigla e, sem ela, o nome', () => {
    expect(siglaOuNome({ sigla: 'LRD', nome: 'Atlética Lorde' })).toBe('LRD')
    expect(siglaOuNome({ sigla: null, nome: 'Atlética Lorde' })).toBe('Atlética Lorde')
  })
})
