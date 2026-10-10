import { HORA_MS } from '../../../common/tempo'
import {
  chaveJob,
  FILA_CONFIRMACAO_PENDENTE,
  FILA_LEMBRETE,
  motivoDescarte,
  planejarJobs,
  recebeConfirmacaoPendente,
  type EventoNaExecucao,
} from './agenda'

const AGORA = new Date('2026-10-10T12:00:00.000Z')
const ID = '0f8b2c4e-1a3d-4e5f-9a7b-6c5d4e3f2a1b'

const daquiA = (horas: number) => new Date(AGORA.getTime() + horas * HORA_MS)

function evento(inicioEmHoras: number, criadoHaHoras = 72) {
  return { id: ID, inicio: daquiA(inicioEmHoras), criadoEm: daquiA(-criadoHaHoras) }
}

const resumo = (jobs: ReturnType<typeof planejarJobs>) =>
  jobs.map(({ fila, horas }) => `${fila === FILA_LEMBRETE ? 'lembrete' : 'pendente'}:${horas}`)

describe('planejarJobs', () => {
  it('evento daqui a 30 h: 4 lembretes e a confirmação pendente em inicio − 24 h', () => {
    const jobs = planejarJobs(evento(30), AGORA)

    expect(resumo(jobs)).toEqual([
      'lembrete:1',
      'lembrete:2',
      'lembrete:6',
      'lembrete:24',
      'pendente:24',
    ])
    const pendente = jobs.find(({ fila }) => fila === FILA_CONFIRMACAO_PENDENTE)
    expect(pendente?.startAfter).toEqual(daquiA(6))
    expect(jobs[0]?.startAfter).toEqual(daquiA(29))
  })

  it('evento daqui a 3 h: só os lembretes de 1 h e 2 h', () => {
    expect(resumo(planejarJobs(evento(3), AGORA))).toEqual(['lembrete:1', 'lembrete:2'])
  })

  it('pula o horário exatamente igual a agora', () => {
    expect(resumo(planejarJobs(evento(2), AGORA))).toEqual(['lembrete:1'])
  })

  it('singletonKey "<tipo>:<eventoId>:<h>:<inicioISO>"', () => {
    const [primeiro] = planejarJobs(evento(30), AGORA)
    expect(primeiro?.singletonKey).toBe(`lembrete:${ID}:1:${daquiA(30).toISOString()}`)
    expect(chaveJob(FILA_CONFIRMACAO_PENDENTE, ID, 24, daquiA(30))).toBe(
      `confirmacao-pendente:${ID}:24:${daquiA(30).toISOString()}`,
    )
  })

  it('evento criado com menos de 24 h de antecedência não agenda a confirmação pendente', () => {
    const criadoAgora = { id: ID, inicio: daquiA(30), criadoEm: daquiA(7) }
    expect(resumo(planejarJobs(criadoAgora, AGORA))).not.toContain('pendente:24')
  })
})

describe('recebeConfirmacaoPendente', () => {
  it('exige ao menos 24 h entre a criação e o início', () => {
    expect(recebeConfirmacaoPendente({ ...evento(30), criadoEm: daquiA(6) })).toBe(true)
    expect(recebeConfirmacaoPendente({ ...evento(30), criadoEm: daquiA(6.01) })).toBe(false)
  })
})

describe('motivoDescarte', () => {
  const vigente: EventoNaExecucao = { status: 'AGENDADO', excluidoEm: null, inicio: daquiA(2) }
  const previsto = daquiA(2).toISOString()

  it('evento agendado com o mesmo início não é descartado', () => {
    expect(motivoDescarte(vigente, previsto, AGORA)).toBeNull()
  })

  it.each([
    ['inexistente', null],
    ['excluido', { ...vigente, excluidoEm: AGORA }],
    ['status', { ...vigente, status: 'CANCELADO' as const }],
    ['status', { ...vigente, status: 'EM_ANDAMENTO' as const }],
    ['inicio-alterado', { ...vigente, inicio: daquiA(26) }],
  ])('descarta por %s', (motivo, atual) => {
    expect(motivoDescarte(atual, previsto, AGORA)).toBe(motivo)
  })

  it('descarta o job atrasado que roda depois do início', () => {
    expect(motivoDescarte(vigente, previsto, daquiA(2))).toBe('iniciado')
  })
})
