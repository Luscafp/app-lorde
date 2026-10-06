import { StatusEvento } from '../enums/evento'
import { avaliarResposta } from './participacao'

const INICIO = '2026-10-10T22:00:00.000Z'
const ANTES = '2026-10-10T21:59:59.999Z'
const DEPOIS = '2026-10-10T22:00:00.001Z'

describe('avaliarResposta', () => {
  it('membro, AGENDADO e antes do início → pode responder (RN30)', () => {
    expect(avaliarResposta({ status: 'AGENDADO', inicio: INICIO }, true, ANTES)).toEqual({
      podeResponder: true,
      motivoBloqueioResposta: null,
    })
  })

  it.each([
    ['no início', INICIO],
    ['depois do início', DEPOIS],
  ])('AGENDADO %s → EVENTO_JA_INICIADO', (_caso, agora) => {
    expect(avaliarResposta({ status: 'AGENDADO', inicio: INICIO }, true, agora)).toEqual({
      podeResponder: false,
      motivoBloqueioResposta: 'EVENTO_JA_INICIADO',
    })
  })

  it.each([
    ['CANCELADO', 'EVENTO_CANCELADO'],
    ['EM_ANDAMENTO', 'EVENTO_NAO_AGENDADO'],
    ['FINALIZADO', 'EVENTO_NAO_AGENDADO'],
  ] as const)('%s antes do início → %s', (status, motivo) => {
    expect(avaliarResposta({ status, inicio: INICIO }, true, ANTES)).toEqual({
      podeResponder: false,
      motivoBloqueioResposta: motivo,
    })
  })

  it.each([
    ['CANCELADO', 'EVENTO_CANCELADO'],
    ['EM_ANDAMENTO', 'EVENTO_NAO_AGENDADO'],
    ['FINALIZADO', 'EVENTO_NAO_AGENDADO'],
  ] as const)('%s depois do início → %s (status antes do horário)', (status, motivo) => {
    expect(avaliarResposta({ status, inicio: INICIO }, true, DEPOIS).motivoBloqueioResposta).toBe(
      motivo,
    )
  })

  it.each(
    Object.values(StatusEvento).flatMap((status) =>
      [ANTES, DEPOIS].map((agora) => ({ status, agora })),
    ),
  )(
    'não membro ($status, $agora) → NAO_MEMBRO_DO_ELENCO antes de qualquer outro motivo',
    ({ status, agora }) => {
      expect(avaliarResposta({ status, inicio: INICIO }, false, agora)).toEqual({
        podeResponder: false,
        motivoBloqueioResposta: 'NAO_MEMBRO_DO_ELENCO',
      })
    },
  )

  it('aceita Date e milissegundos', () => {
    const inicio = new Date(INICIO)
    expect(avaliarResposta({ status: 'AGENDADO', inicio }, true, inicio.getTime() - 1)).toEqual({
      podeResponder: true,
      motivoBloqueioResposta: null,
    })
  })
})
