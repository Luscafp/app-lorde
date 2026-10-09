import { AcaoAuditoria, EntidadeAuditoria } from './acoes'
import {
  alteracoesDaAuditoria,
  formatarValorAuditoria,
  ROTULOS_ACAO,
  ROTULOS_ENTIDADE,
  rotuloAcao,
  rotuloCampo,
} from './rotulos'

describe('rótulos da auditoria', () => {
  it('toda ação e toda entidade do catálogo têm rótulo', () => {
    for (const acao of Object.values(AcaoAuditoria)) expect(ROTULOS_ACAO[acao]).toBeTruthy()
    for (const entidade of Object.values(EntidadeAuditoria)) {
      expect(ROTULOS_ENTIDADE[entidade]).toBeTruthy()
    }
    expect(Object.keys(ROTULOS_ACAO).sort()).toEqual(Object.values(AcaoAuditoria).sort())
  })

  it('código fora do dicionário aparece cru', () => {
    expect(rotuloAcao('PRESENCAS_REGISTRADAS')).toBe('Presenças registradas')
    expect(rotuloAcao('ACAO_NOVA')).toBe('ACAO_NOVA')
    expect(rotuloCampo('campoNovo')).toBe('campoNovo')
  })
})

describe('formatarValorAuditoria', () => {
  it.each([
    ['ativo', true, 'Sim'],
    ['ativo', false, 'Não'],
    ['resultado', 'EMPATE', 'Empate'],
    ['status', 'EM_ANDAMENTO', 'Em andamento'],
    ['papel', 'VICE_PRESIDENTE', 'Vice-presidente'],
    ['local', 'EMPATE', 'EMPATE'],
    ['inicio', '2026-10-12T22:00:00.000Z', '12/10/2026 19:00'],
    ['dataFim', '2027-04-05', '05/04/2027'],
    ['diasSemana', [1, 3], 'Seg, Qua'],
    ['observacoes', null, '—'],
    ['timeIds', [], '—'],
    ['placarTime', 0, '0'],
  ])('%s = %o → %s', (campo, valor, esperado) => {
    expect(formatarValorAuditoria(campo, valor)).toBe(esperado)
  })

  it('resolve ids pelas referências', () => {
    const id = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
    expect(formatarValorAuditoria('usuarioId', id, { [id]: 'Ana' })).toBe('Ana')
    expect(formatarValorAuditoria('usuarioId', id)).toBe(id)
  })
})

describe('alteracoesDaAuditoria', () => {
  it('correção de placar: Campo · Antes · Depois', () => {
    expect(
      alteracoesDaAuditoria({
        antes: { placarTime: 2, resultado: 'EMPATE' },
        depois: { placarTime: 3, resultado: 'VITORIA' },
      }),
    ).toEqual({
      alteracoes: [
        { campo: 'placarTime', rotulo: 'Placar da atlética', antes: '2', depois: '3' },
        { campo: 'resultado', rotulo: 'Resultado', antes: 'Empate', depois: 'Vitória' },
      ],
      contexto: [],
    })
  })

  it('criação e exclusão usam "—" no lado nulo; contexto vira lista', () => {
    const resultado = alteracoesDaAuditoria({
      antes: { saidaEm: null },
      depois: { saidaEm: '2026-10-01T12:00:00.000Z' },
      contexto: { capitaniaRemovida: true },
    })
    expect(resultado?.alteracoes).toEqual([
      { campo: 'saidaEm', rotulo: 'Saída em', antes: '—', depois: '01/10/2026 09:00' },
    ])
    expect(resultado?.contexto).toEqual([
      { campo: 'capitaniaRemovida', rotulo: 'Capitania removida', valor: 'Sim' },
    ])
    expect(alteracoesDaAuditoria({ antes: null, depois: { nome: 'Vôlei' } })?.alteracoes).toEqual([
      { campo: 'nome', rotulo: 'Nome', antes: '—', depois: 'Vôlei' },
    ])
  })

  it.each([
    null,
    'x',
    [],
    { antes: {} },
    { antes: {}, depois: {}, extra: 1 },
    { antes: 1, depois: {} },
  ])('formato inesperado %o → null', (dados) => {
    expect(alteracoesDaAuditoria(dados)).toBeNull()
  })
})
