import { filtroPeriodo, ordemPadrao } from './periodo'

const proximos = (hojeLocal: string) => ({
  OR: [
    { status: 'EM_ANDAMENTO' },
    { status: { in: ['AGENDADO', 'CANCELADO'] }, inicio: { gte: new Date(hojeLocal) } },
  ],
})

describe('filtroPeriodo', () => {
  it('PROXIMOS: em andamento, ou agendado/cancelado a partir de 00:00 local de hoje (RN18)', () => {
    expect(filtroPeriodo('PROXIMOS', new Date('2026-10-07T15:00:00.000Z'))).toEqual(
      proximos('2026-10-07T03:00:00.000Z'),
    )
  })

  it('01:00 UTC (22:00 em Fortaleza) usa o dia local anterior', () => {
    expect(filtroPeriodo('PROXIMOS', new Date('2026-10-07T01:00:00.000Z'))).toEqual(
      proximos('2026-10-06T03:00:00.000Z'),
    )
  })

  it('PASSADOS é a negação de PROXIMOS', () => {
    const agora = new Date('2026-10-07T15:00:00.000Z')
    expect(filtroPeriodo('PASSADOS', agora)).toEqual({ NOT: proximos('2026-10-07T03:00:00.000Z') })
  })

  it('TODOS não filtra', () => {
    expect(filtroPeriodo('TODOS', new Date())).toEqual({})
  })
})

describe('ordemPadrao', () => {
  it.each([
    ['PROXIMOS', 'asc'],
    ['PASSADOS', 'desc'],
    ['TODOS', 'desc'],
  ] as const)('%s → %s', (periodo, ordem) => {
    expect(ordemPadrao(periodo)).toBe(ordem)
  })
})
