import { listarAuditoriaQuerySchema, periodoAuditoria } from './schemas'

const ID = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'

function campos(resultado: { error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return (resultado.error?.issues ?? []).map(({ path }) => path.join('.'))
}

describe('periodoAuditoria', () => {
  it('dias locais cobrem 00:00 de `de` a 23:59:59.999 de `ate` em America/Fortaleza', () => {
    const { de, ate } = periodoAuditoria({ de: '2026-09-01', ate: '2026-09-15' })
    expect(de.toISOString()).toBe('2026-09-01T03:00:00.000Z')
    expect(ate.toISOString()).toBe('2026-09-16T02:59:59.999Z')
  })

  it('sem limites: os últimos 30 dias até agora', () => {
    const agora = Date.parse('2026-10-08T12:00:00.000Z')
    const { de, ate } = periodoAuditoria({}, agora)
    expect(ate.toISOString()).toBe('2026-10-08T12:00:00.000Z')
    expect(de.toISOString()).toBe('2026-09-08T12:00:00.000Z')
  })

  it('instantes ISO são usados como vieram', () => {
    const { de, ate } = periodoAuditoria({
      de: '2026-09-01T10:00:00.000Z',
      ate: '2026-09-02T10:00:00+02:00',
    })
    expect(de.toISOString()).toBe('2026-09-01T10:00:00.000Z')
    expect(ate.toISOString()).toBe('2026-09-02T08:00:00.000Z')
  })
})

describe('listarAuditoriaQuerySchema', () => {
  it('sem parâmetros: página 1, limite 20', () => {
    expect(listarAuditoriaQuerySchema.parse({})).toEqual({ page: 1, limit: 20 })
  })

  it('aceita todos os filtros combinados', () => {
    const query = {
      entidade: 'Evento',
      entidadeId: ID,
      usuarioId: ID,
      acao: 'RESULTADO_CORRIGIDO',
      de: '2026-09-01',
      ate: '2026-09-15',
      page: '2',
      limit: '50',
    }
    expect(listarAuditoriaQuerySchema.parse(query)).toEqual({ ...query, page: 2, limit: 50 })
  })

  it.each([
    [{ limit: '100' }, 'limit'],
    [{ entidade: 'Sessao' }, 'entidade'],
    [{ acao: 'CRIAR' }, 'acao'],
    [{ entidade: 'Evento', entidadeId: 'abc' }, 'entidadeId'],
    [{ entidadeId: ID }, 'entidadeId'],
    [{ usuarioId: 'x' }, 'usuarioId'],
    [{ de: '2026-02-30' }, 'de'],
    [{ ate: 'ontem' }, 'ate'],
    [{ de: '2026-09-15', ate: '2026-09-01' }, 'ate'],
    [{ de: '2025-01-01', ate: '2026-01-02' }, 'ate'],
    [{ autorId: ID }, ''],
  ])('rejeita %o', (query, campo) => {
    expect(campos(listarAuditoriaQuerySchema.safeParse(query))).toEqual([campo])
  })

  it('366 dias é o máximo aceito', () => {
    expect(
      listarAuditoriaQuerySchema.safeParse({ de: '2025-01-01', ate: '2026-01-01' }).success,
    ).toBe(true)
  })
})
