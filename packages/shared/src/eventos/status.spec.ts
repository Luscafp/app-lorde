import { StatusEvento } from '../enums/evento'
import { alterarStatusSchema, transicaoPermitida, TRANSICOES_STATUS } from './status'

describe('TRANSICOES_STATUS', () => {
  it('é a tabela do épico #21 §4', () => {
    expect(TRANSICOES_STATUS).toEqual({
      AGENDADO: ['EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO'],
      EM_ANDAMENTO: ['AGENDADO', 'FINALIZADO', 'CANCELADO'],
      FINALIZADO: ['EM_ANDAMENTO'],
      CANCELADO: [],
    })
  })

  const todos = Object.values(StatusEvento)
  const pares = todos.flatMap((de) => todos.map((para) => [de, para] as const))

  it.each(pares)('%s → %s', (de, para) => {
    expect(transicaoPermitida(de, para)).toBe(TRANSICOES_STATUS[de].includes(para))
  })

  it('nenhum status transita para si mesmo', () => {
    for (const status of todos) expect(TRANSICOES_STATUS[status]).not.toContain(status)
  })
})

describe('alterarStatusSchema', () => {
  it('aceita os quatro status', () => {
    for (const status of Object.values(StatusEvento)) {
      expect(alterarStatusSchema.parse({ status })).toEqual({ status })
    }
  })

  it.each([{}, { status: 'ENCERRADO' }, { status: 'AGENDADO', motivo: 'x' }])(
    'rejeita %j',
    (corpo) => {
      expect(alterarStatusSchema.safeParse(corpo).success).toBe(false)
    },
  )
})
