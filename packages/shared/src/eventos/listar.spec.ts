import { listarEventosQuerySchema } from './schemas'

const UUID = '0b6f1f0e-2b7a-4d4e-9a65-1c2b3c4d5e6f'

function campos(resultado: { error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return (resultado.error?.issues ?? []).map(({ path }) => path.join('.'))
}

describe('listarEventosQuerySchema', () => {
  it('padrões: PROXIMOS, página 1 de 20, booleanos falsos e sem filtros', () => {
    expect(listarEventosQuerySchema.parse({})).toEqual({
      periodo: 'PROXIMOS',
      confirmadoPorMim: false,
      incluirInativos: false,
      page: 1,
      limit: 20,
    })
  })

  it('aceita todos os filtros juntos', () => {
    expect(
      listarEventosQuerySchema.parse({
        periodo: 'TODOS',
        tipo: 'JOGO',
        modalidadeId: UUID,
        timeId: UUID,
        status: 'FINALIZADO',
        resultado: 'PENDENTE',
        serieId: UUID,
        aPartirDe: '2026-10-10T22:00:00.000Z',
        confirmadoPorMim: 'true',
        incluirInativos: 'true',
        ordem: 'asc',
        page: '3',
        limit: '50',
      }),
    ).toEqual({
      periodo: 'TODOS',
      tipo: 'JOGO',
      modalidadeId: UUID,
      timeId: UUID,
      status: ['FINALIZADO'],
      resultado: 'PENDENTE',
      serieId: UUID,
      aPartirDe: '2026-10-10T22:00:00.000Z',
      confirmadoPorMim: true,
      incluirInativos: true,
      ordem: 'asc',
      page: 3,
      limit: 50,
    })
  })

  it('status múltiplo separado por vírgula, sem repetições', () => {
    expect(
      listarEventosQuerySchema.parse({ status: 'AGENDADO, CANCELADO,AGENDADO' }).status,
    ).toEqual(['AGENDADO', 'CANCELADO'])
  })

  it('aPartirDe com offset', () => {
    expect(
      listarEventosQuerySchema.safeParse({ aPartirDe: '2026-10-10T19:00:00+01:00' }).success,
    ).toBe(true)
  })

  it.each([
    ['limit=51', { limit: '51' }, 'limit'],
    ['limit=0', { limit: '0' }, 'limit'],
    ['page=0', { page: '0' }, 'page'],
    ['periodo=OUTRO', { periodo: 'OUTRO' }, 'periodo'],
    ['modalidadeId não-UUID', { modalidadeId: 'volei' }, 'modalidadeId'],
    ['timeId não-UUID', { timeId: '1' }, 'timeId'],
    ['serieId não-UUID', { serieId: '1' }, 'serieId'],
    ['tipo desconhecido', { tipo: 'AMISTOSO' }, 'tipo'],
    ['status desconhecido', { status: 'AGENDADO,ADIADO' }, 'status'],
    ['status vazio', { status: '' }, 'status'],
    ['status repetido na query', { status: ['AGENDADO', 'CANCELADO'] }, 'status'],
    ['resultado desconhecido', { resultado: 'VITORIA' }, 'resultado'],
    ['aPartirDe sem fuso', { aPartirDe: '2026-10-10T22:00:00' }, 'aPartirDe'],
    ['confirmadoPorMim inválido', { confirmadoPorMim: 'sim' }, 'confirmadoPorMim'],
    ['incluirInativos inválido', { incluirInativos: '1' }, 'incluirInativos'],
    ['ordem inválida', { ordem: 'crescente' }, 'ordem'],
    ['parâmetro desconhecido', { usuarioId: UUID }, ''],
  ])('rejeita %s', (_caso, query, campo) => {
    expect(campos(listarEventosQuerySchema.safeParse(query))).toEqual([campo])
  })
})
