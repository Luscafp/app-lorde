import { chaveDiaLocal, diaDaSemana, formatarHora } from '../utils/datas'
import {
  criarEventoOuSerieSchema,
  editarOcorrenciaSchema,
  gerarDatasSerie,
  recorrenciaSchema,
  type Recorrencia,
} from './recorrencia'

const TIME = '0b6f1f0e-2b7a-4d4e-9a65-1c2b3c4d5e6f'
const AGORA = new Date('2026-10-01T12:00:00.000Z')
const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6]

const serie = (dados: Partial<Recorrencia> = {}): Recorrencia => ({
  dataInicio: '2026-10-05',
  horario: '18:30',
  diasSemana: [1, 3],
  dataFim: '2027-04-05',
  ...dados,
})

function campos(resultado: { error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return (resultado.error?.issues ?? []).map(({ path }) => path.join('.'))
}

describe('gerarDatasSerie', () => {
  it('Seg e Qua de 05/10/2026 a 05/04/2027 às 18:30 geram 53 treinos às 21:30Z', () => {
    const datas = gerarDatasSerie(serie(), AGORA)

    expect(datas).toHaveLength(53)
    expect(datas.every((data) => data.toISOString().endsWith('T21:30:00.000Z'))).toBe(true)
    expect(datas[0]?.toISOString()).toBe('2026-10-05T21:30:00.000Z')
    expect(datas.at(-1)?.toISOString()).toBe('2027-04-05T21:30:00.000Z')
    expect(new Set(datas.map((data) => diaDaSemana(chaveDiaLocal(data))))).toEqual(new Set([1, 3]))
  })

  it.each([
    ['2026-10-01', '2027-04-01', 183],
    ['2026-07-01', '2027-01-01', 185],
  ])('todos os dias de %s a %s geram %i', (dataInicio, dataFim, total) => {
    const agora = new Date('2026-06-01T12:00:00.000Z')
    const datas = gerarDatasSerie(serie({ dataInicio, dataFim, diasSemana: TODOS_OS_DIAS }), agora)
    expect(datas).toHaveLength(total)
  })

  it('omite a ocorrência de hoje cujo horário já passou e mantém a que ainda não começou', () => {
    const hoje = serie({ dataInicio: '2026-10-01', dataFim: '2026-10-01', diasSemana: [4] })
    const dezDaManha = new Date('2026-10-01T13:00:00.000Z')

    expect(gerarDatasSerie({ ...hoje, horario: '07:00' }, dezDaManha)).toEqual([])
    expect(gerarDatasSerie({ ...hoje, horario: '18:00' }, dezDaManha)).toEqual([
      new Date('2026-10-01T21:00:00.000Z'),
    ])
  })

  it('23:30 local cai às 02:30Z do dia seguinte sem deslocar o dia da semana', () => {
    const datas = gerarDatasSerie(
      serie({ dataInicio: '2026-10-05', dataFim: '2026-10-11', diasSemana: [1], horario: '23:30' }),
      AGORA,
    )
    expect(datas).toEqual([new Date('2026-10-06T02:30:00.000Z')])
    expect(chaveDiaLocal(datas[0] ?? 0)).toBe('2026-10-05')
  })

  it.each(Array.from({ length: 12 }, (_, mes) => mes + 1))(
    'conversão estável no mês %i (America/Fortaleza sem horário de verão)',
    (mes) => {
      const dia = `2027-${String(mes).padStart(2, '0')}-10`
      const [data] = gerarDatasSerie(
        { dataInicio: dia, dataFim: dia, diasSemana: TODOS_OS_DIAS, horario: '18:30' },
        AGORA,
      )
      expect(data?.toISOString()).toBe(`${dia}T21:30:00.000Z`)
      expect(formatarHora(data ?? 0)).toBe('18:30')
    },
  )
})

describe('recorrenciaSchema', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: AGORA })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('aceita até 6 meses de calendário e ordena os dias', () => {
    const dados = serie({ dataInicio: '2026-10-05', dataFim: '2027-04-05', diasSemana: [3, 1] })
    expect(recorrenciaSchema.parse(dados).diasSemana).toEqual([1, 3])
    expect(
      recorrenciaSchema.safeParse(serie({ dataInicio: '2027-08-31', dataFim: '2028-02-29' }))
        .success,
    ).toBe(true)
  })

  it.each([
    [{ dataFim: '2027-04-06' }, 'dataFim'],
    [{ dataInicio: '2026-08-31', dataFim: '2027-03-01' }, 'dataInicio'],
    [{ dataFim: '2026-10-04' }, 'dataFim'],
    [{ dataInicio: '2026-09-30' }, 'dataInicio'],
    [{ diasSemana: [] }, 'diasSemana'],
    [{ diasSemana: [7] }, 'diasSemana.0'],
    [{ diasSemana: [1, 1] }, 'diasSemana'],
    [{ horario: '24:00' }, 'horario'],
    [{ horario: '8:00' }, 'horario'],
    [{ dataInicio: '05/10/2026' }, 'dataInicio'],
  ])('rejeita %j em %s', (dados, campo) => {
    expect(campos(recorrenciaSchema.safeParse(serie(dados)))).toContain(campo)
  })

  it('aceita começar hoje', () => {
    expect(
      recorrenciaSchema.safeParse(serie({ dataInicio: '2026-10-01', dataFim: '2027-04-01' }))
        .success,
    ).toBe(true)
  })
})

describe('criarEventoOuSerieSchema', () => {
  const corpo = { tipo: 'TREINO', timeId: TIME, local: 'Quadra do CCET', recorrencia: serie() }

  beforeEach(() => {
    jest.useFakeTimers({ now: AGORA })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('com recorrência valida a série', () => {
    expect(criarEventoOuSerieSchema.parse(corpo)).toEqual(corpo)
  })

  it('sem recorrência valida o evento avulso', () => {
    const avulso = { tipo: 'TREINO', timeId: TIME, local: 'Quadra', inicio: '2026-10-02T21:00:00Z' }
    expect(criarEventoOuSerieSchema.parse(avulso)).toEqual(avulso)
  })

  it('mantém o caminho dos erros da recorrência', () => {
    const resultado = criarEventoOuSerieSchema.safeParse({
      ...corpo,
      recorrencia: serie({ dataFim: '2027-04-06' }),
    })
    expect(campos(resultado)).toEqual(['recorrencia.dataFim'])
  })

  it.each([
    [{ tipo: 'JOGO' }, 'tipo'],
    [{ inicio: '2026-10-02T21:00:00Z' }, ''],
  ])('rejeita %j', (dados, campo) => {
    expect(campos(criarEventoOuSerieSchema.safeParse({ ...corpo, ...dados }))).toContain(campo)
  })
})

describe('editarOcorrenciaSchema', () => {
  it('ESTA_E_SEGUINTES aceita horário, local e observações', () => {
    const dados = { escopo: 'ESTA_E_SEGUINTES', horario: '19:00', local: 'Quadra 2' }
    expect(editarOcorrenciaSchema.parse(dados)).toEqual(dados)
  })

  it('sem escopo segue a edição avulsa', () => {
    expect(editarOcorrenciaSchema.parse({ inicio: '2026-10-02T21:00:00Z' })).toEqual({
      inicio: '2026-10-02T21:00:00Z',
    })
  })

  it.each([
    { escopo: 'ESTA_E_SEGUINTES' },
    { escopo: 'ESTA_E_SEGUINTES', inicio: '2026-10-02T21:00:00Z' },
    { escopo: 'ESTA_E_SEGUINTES', timeId: TIME },
    { escopo: 'ESTA_E_SEGUINTES', horario: '7:00' },
    { escopo: 'ESTA', horario: '19:00' },
  ])('rejeita %j', (dados) => {
    expect(editarOcorrenciaSchema.safeParse(dados).success).toBe(false)
  })
})
