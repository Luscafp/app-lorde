import { StatusEvento } from '../enums/evento'
import {
  alterarStatusSchema,
  cancelarEventoSchema,
  criarEventoSchema,
  editarEventoSchema,
  inicioNoIntervalo,
  LOCAL_EVENTO_MAX,
  OBSERVACOES_EVENTO_MAX,
  PLACAR_MAX,
  registrarResultadoSchema,
} from './schemas'

const TIME = '0b6f1f0e-2b7a-4d4e-9a65-1c2b3c4d5e6f'
const ADVERSARIO = '7d1e2f3a-4b5c-4d6e-8f90-a1b2c3d4e5f6'
const AMANHA = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
const DIA_MS = 24 * 60 * 60 * 1000

const treino = { tipo: 'TREINO', timeId: TIME, inicio: AMANHA, local: 'Ginásio' }
const jogo = { ...treino, tipo: 'JOGO', timeAdversarioId: ADVERSARIO }

function campos(resultado: { error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return (resultado.error?.issues ?? []).map(({ path }) => path.join('.'))
}

describe('criarEventoSchema', () => {
  it('aceita Treino e Jogo, aparando local e observações', () => {
    expect(
      criarEventoSchema.parse({ ...treino, local: '  Quadra  ', observacoes: ' Levar água ' }),
    ).toEqual({ ...treino, local: 'Quadra', observacoes: 'Levar água' })
    expect(criarEventoSchema.parse(jogo)).toEqual(jogo)
  })

  it('Jogo sem adversário → timeAdversarioId (critério 3)', () => {
    const { timeAdversarioId: _, ...semAdversario } = jogo
    expect(campos(criarEventoSchema.safeParse(semAdversario))).toEqual(['timeAdversarioId'])
  })

  it('Treino com adversário → timeAdversarioId; null é aceito (critério 5)', () => {
    expect(
      campos(criarEventoSchema.safeParse({ ...treino, timeAdversarioId: ADVERSARIO })),
    ).toEqual(['timeAdversarioId'])
    expect(criarEventoSchema.safeParse({ ...treino, timeAdversarioId: null }).success).toBe(true)
  })

  it.each(['atleticaId', 'status', 'placarTime', 'resultado', 'excluidoEm', 'criadoPorId'])(
    'rejeita %s no corpo (mass assignment)',
    (campo) => {
      expect(criarEventoSchema.safeParse({ ...jogo, [campo]: 'x' }).success).toBe(false)
    },
  )

  it('rejeita tipo desconhecido', () => {
    expect(campos(criarEventoSchema.safeParse({ ...treino, tipo: 'AMISTOSO' }))).toEqual(['tipo'])
  })

  it.each([
    ['local com 1 caractere', { local: 'a' }, 'local'],
    ['local com 121 caracteres', { local: 'x'.repeat(LOCAL_EVENTO_MAX + 1) }, 'local'],
    ['local só com espaços', { local: '   ' }, 'local'],
    ['observações com 501', { observacoes: 'x'.repeat(OBSERVACOES_EVENTO_MAX + 1) }, 'observacoes'],
    ['inicio sem fuso', { inicio: '2026-10-10T22:00:00' }, 'inicio'],
    ['inicio inválido', { inicio: 'amanhã' }, 'inicio'],
    ['timeId não-UUID', { timeId: 'x' }, 'timeId'],
  ])('rejeita %s', (_caso, dados, campo) => {
    expect(campos(criarEventoSchema.safeParse({ ...treino, ...dados }))).toEqual([campo])
  })

  it('aceita local com 2 e 120 caracteres e observações com 500', () => {
    for (const local of ['ab', 'x'.repeat(LOCAL_EVENTO_MAX)]) {
      expect(criarEventoSchema.safeParse({ ...treino, local }).success).toBe(true)
    }
    const observacoes = 'x'.repeat(OBSERVACOES_EVENTO_MAX)
    expect(criarEventoSchema.safeParse({ ...treino, observacoes }).success).toBe(true)
  })

  it('aceita inicio com offset', () => {
    expect(
      criarEventoSchema.safeParse({ ...treino, inicio: AMANHA.replace('Z', '+00:00') }).success,
    ).toBe(true)
  })
})

describe('inicioNoIntervalo', () => {
  const agora = Date.parse('2026-10-01T12:00:00.000Z')
  const em = (dias: number) => new Date(agora + dias * DIA_MS).toISOString()

  it.each([
    [-365, true],
    [-366, false],
    [730, true],
    [731, false],
  ])('%i dias → %s', (dias, esperado) => {
    expect(inicioNoIntervalo(em(dias), agora)).toBe(esperado)
  })
})

describe('editarEventoSchema', () => {
  it.each([
    { local: 'Quadra' },
    { inicio: AMANHA },
    { observacoes: null },
    { timeId: TIME },
    { timeAdversarioId: ADVERSARIO },
  ])('aceita %j', (dados) => {
    expect(editarEventoSchema.safeParse(dados).success).toBe(true)
  })

  it('observações vazias viram null', () => {
    expect(editarEventoSchema.parse({ observacoes: '  ' })).toEqual({ observacoes: null })
  })

  it.each([{}, { tipo: 'JOGO' }, { status: 'CANCELADO' }, { placarTime: 1 }])(
    'rejeita %j',
    (dados) => {
      expect(editarEventoSchema.safeParse(dados).success).toBe(false)
    },
  )
})

describe('cancelarEventoSchema', () => {
  it('aceita corpo ausente ou vazio e rejeita campos', () => {
    expect(cancelarEventoSchema.parse(undefined)).toEqual({})
    expect(cancelarEventoSchema.parse({})).toEqual({})
    expect(cancelarEventoSchema.safeParse({ escopo: 'ESTA' }).success).toBe(false)
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

describe('registrarResultadoSchema', () => {
  const placar = { placarTime: 3, placarAdversario: 1 }

  it('aceita placar com e sem finalizar', () => {
    expect(registrarResultadoSchema.parse(placar)).toEqual(placar)
    expect(registrarResultadoSchema.parse({ ...placar, finalizar: true })).toEqual({
      ...placar,
      finalizar: true,
    })
  })

  it('aceita os limites 0 e 999', () => {
    expect(
      registrarResultadoSchema.safeParse({ placarTime: 0, placarAdversario: PLACAR_MAX }).success,
    ).toBe(true)
  })

  it.each([
    ['placarTime -1', { placarTime: -1 }, 'placarTime'],
    ['placarTime 1000', { placarTime: 1000 }, 'placarTime'],
    ['placarTime 2.5', { placarTime: 2.5 }, 'placarTime'],
    ['placarTime texto', { placarTime: '3' }, 'placarTime'],
    ['placarAdversario ausente', { placarAdversario: undefined }, 'placarAdversario'],
    ['finalizar não booleano', { finalizar: 'sim' }, 'finalizar'],
  ])('rejeita %s', (_caso, dados, campo) => {
    const resultado = registrarResultadoSchema.safeParse({ ...placar, ...dados })
    expect(resultado.error?.issues.map(({ path }) => path.join('.'))).toEqual([campo])
  })

  it('rejeita resultado enviado pelo cliente (.strict())', () => {
    expect(registrarResultadoSchema.safeParse({ ...placar, resultado: 'VITORIA' }).success).toBe(
      false,
    )
  })
})
