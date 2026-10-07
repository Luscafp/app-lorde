import type { Prisma, StatusEvento } from '../../generated/prisma/client'
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

interface EventoAvaliado {
  status: StatusEvento
  inicio: Date
}

/** Avalia em memória o subconjunto de `where` que `filtroPeriodo` gera. */
function atende(where: Prisma.EventoWhereInput, evento: EventoAvaliado): boolean {
  const { OR, NOT, status, inicio } = where as {
    OR?: Prisma.EventoWhereInput[]
    NOT?: Prisma.EventoWhereInput
    status?: StatusEvento | { in: StatusEvento[] }
    inicio?: { gte: Date }
  }
  if (OR && !OR.some((condicao) => atende(condicao, evento))) return false
  if (NOT && atende(NOT, evento)) return false
  if (typeof status === 'string' && evento.status !== status) return false
  if (typeof status === 'object' && !status.in.includes(evento.status)) return false
  if (inicio && evento.inicio < inicio.gte) return false
  return true
}

describe('filtroPeriodo — casos de fuso do épico §11', () => {
  // 12:00 de 07/10 em Fortaleza.
  const agora = new Date('2026-10-07T15:00:00.000Z')

  it.each<[string, StatusEvento, string, 'PROXIMOS' | 'PASSADOS']>([
    ['cancelado hoje 00:30 local', 'CANCELADO', '2026-10-07T03:30:00.000Z', 'PROXIMOS'],
    ['agendado hoje que já começou', 'AGENDADO', '2026-10-07T11:00:00.000Z', 'PROXIMOS'],
    ['cancelado ontem 23:59 local', 'CANCELADO', '2026-10-07T02:59:00.000Z', 'PASSADOS'],
    ['AGENDADO de ontem', 'AGENDADO', '2026-10-06T15:00:00.000Z', 'PASSADOS'],
    ['EM_ANDAMENTO de ontem', 'EM_ANDAMENTO', '2026-10-06T15:00:00.000Z', 'PROXIMOS'],
    ['FINALIZADO futuro', 'FINALIZADO', '2026-10-09T15:00:00.000Z', 'PASSADOS'],
  ])('%s → %s', (_caso, status, inicio, esperado) => {
    const evento = { status, inicio: new Date(inicio) }
    expect(atende(filtroPeriodo('PROXIMOS', agora), evento)).toBe(esperado === 'PROXIMOS')
    expect(atende(filtroPeriodo('PASSADOS', agora), evento)).toBe(esperado === 'PASSADOS')
  })

  it('cancelado hoje fica em PROXIMOS até 23:59 local e sai à meia-noite', () => {
    const evento = { status: 'CANCELADO' as const, inicio: new Date('2026-10-07T11:00:00.000Z') }
    expect(atende(filtroPeriodo('PROXIMOS', new Date('2026-10-08T02:59:00.000Z')), evento)).toBe(
      true,
    )
    expect(atende(filtroPeriodo('PROXIMOS', new Date('2026-10-08T03:00:00.000Z')), evento)).toBe(
      false,
    )
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
