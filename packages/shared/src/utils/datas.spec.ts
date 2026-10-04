import {
  chaveDiaLocal,
  formatarData,
  formatarDataHora,
  formatarHora,
  FUSO_PADRAO,
  localParaUtc,
} from './datas'

const INVALIDOS = ['', 'abc', '2026-13-45T25:00:00Z', Number.NaN, new Date('x')]

describe('FUSO_PADRAO', () => {
  it('é America/Fortaleza', () => {
    expect(FUSO_PADRAO).toBe('America/Fortaleza')
  })
})

describe('formatarDataHora', () => {
  it.each([
    ['2026-10-01T22:00:00.000Z', '01/10/2026 19:00'],
    ['2026-10-02T02:30:00Z', '01/10/2026 23:30'],
    ['2026-01-01T02:59:59.999Z', '31/12/2025 23:59'],
    ['2026-10-01T03:00:00.000Z', '01/10/2026 00:00'],
  ])('%s → %s', (iso, esperado) => {
    expect(formatarDataHora(iso)).toBe(esperado)
  })

  it('aceita Date e milissegundos', () => {
    const instante = Date.parse('2026-10-01T22:00:00.000Z')
    expect(formatarDataHora(instante)).toBe('01/10/2026 19:00')
    expect(formatarDataHora(new Date(instante))).toBe('01/10/2026 19:00')
  })

  it.each(INVALIDOS)('lança erro para %p', (valor) => {
    expect(() => formatarDataHora(valor)).toThrow('Data inválida')
  })
})

describe('formatarData e formatarHora', () => {
  it('usam o dia e a hora locais', () => {
    expect(formatarData('2026-10-02T02:30:00.000Z')).toBe('01/10/2026')
    expect(formatarHora('2026-10-02T02:30:00.000Z')).toBe('23:30')
  })

  it.each(INVALIDOS)('lançam erro para %p', (valor) => {
    expect(() => formatarData(valor)).toThrow('Data inválida')
    expect(() => formatarHora(valor)).toThrow('Data inválida')
  })
})

describe('chaveDiaLocal', () => {
  it.each([
    ['2026-10-02T02:30:00.000Z', '2026-10-01'],
    ['2026-10-02T03:00:00.000Z', '2026-10-02'],
    ['2027-01-01T02:59:00.000Z', '2026-12-31'],
  ])('%s → %s', (iso, esperado) => {
    expect(chaveDiaLocal(iso)).toBe(esperado)
  })

  it.each(INVALIDOS)('lança erro para %p', (valor) => {
    expect(() => chaveDiaLocal(valor)).toThrow('Data inválida')
  })
})

describe('localParaUtc', () => {
  it('converte com virada de dia em UTC', () => {
    expect(localParaUtc('2026-10-01', '23:30').toISOString()).toBe('2026-10-02T02:30:00.000Z')
    expect(chaveDiaLocal('2026-10-02T02:30:00.000Z')).toBe('2026-10-01')
  })

  it('converte com virada de ano em UTC', () => {
    expect(localParaUtc('2026-12-31', '23:30').toISOString()).toBe('2027-01-01T02:30:00.000Z')
    expect(localParaUtc('2026-01-01', '00:00').toISOString()).toBe('2026-01-01T03:00:00.000Z')
  })

  it.each(Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')))(
    'ida e volta no mês %s',
    (mes) => {
      for (const [dia, hora] of [
        ['01', '00:00'],
        ['15', '12:45'],
        ['28', '23:59'],
      ] as const) {
        const data = `2026-${mes}-${dia}`
        const instante = localParaUtc(data, hora)
        expect(chaveDiaLocal(instante)).toBe(data)
        expect(formatarHora(instante)).toBe(hora)
        expect(formatarData(instante)).toBe(`${dia}/${mes}/2026`)
      }
    },
  )

  it.each([
    ['2026-02-29', '10:00'],
    ['2026-04-31', '10:00'],
    ['2026-1-01', '10:00'],
    ['2026-10-01', '24:00'],
    ['2026-10-01', '9:00'],
    ['2026-10-01', '10:60'],
    ['', ''],
  ])('lança erro para %p %p', (data, hora) => {
    expect(() => localParaUtc(data, hora)).toThrow('inválida')
  })
})
