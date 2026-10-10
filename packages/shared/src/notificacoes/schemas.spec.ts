import { preferenciasSchema } from './dtos'
import { atualizarPreferenciasSchema, registrarDispositivoSchema } from './schemas'

const PADRAO = {
  pushAtivo: true,
  novosEventos: true,
  alteracoesEventos: true,
  lembretes: true,
  antecedenciaLembreteHoras: 2,
  resultados: true,
  noticias: true,
  solicitacoes: true,
  avisos: true,
}

describe('preferenciasSchema', () => {
  it('aceita os padrões da seção 3.4', () => {
    expect(preferenciasSchema.parse(PADRAO)).toEqual(PADRAO)
  })
})

describe('atualizarPreferenciasSchema', () => {
  it.each([
    [{ noticias: false }],
    [{ antecedenciaLembreteHoras: 24 }],
    [{ pushAtivo: false, lembretes: false }],
  ])('aceita parcial válido %o', (corpo) => {
    expect(atualizarPreferenciasSchema.parse(corpo)).toEqual(corpo)
  })

  it.each([1, 2, 6, 24])('aceita antecedência de %i h', (horas) => {
    const corpo = { antecedenciaLembreteHoras: horas }
    expect(atualizarPreferenciasSchema.safeParse(corpo).success).toBe(true)
  })

  it.each([
    ['vazio', {}, []],
    ['campo extra', { noticias: false, papel: 'ADMIN' }, []],
    ['só campo desconhecido', { cargo: false }, []],
    ['antecedência 3', { antecedenciaLembreteHoras: 3 }, ['antecedenciaLembreteHoras']],
    ['antecedência em texto', { antecedenciaLembreteHoras: '2' }, ['antecedenciaLembreteHoras']],
    ['interruptor em texto', { noticias: 'false' }, ['noticias']],
    ['nulo', { lembretes: null }, ['lembretes']],
  ])('rejeita %s', (_, corpo, caminho) => {
    const resultado = atualizarPreferenciasSchema.safeParse(corpo)
    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0]?.path).toEqual(caminho)
  })
})

describe('registrarDispositivoSchema', () => {
  it.each(['ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', 'ExpoPushToken[abc-123]'])(
    'aceita %s',
    (tokenPush) => {
      const corpo = { tokenPush, plataforma: 'android' }
      expect(registrarDispositivoSchema.parse(corpo)).toEqual(corpo)
    },
  )

  it.each([
    ['token fora do formato', { tokenPush: 'abc', plataforma: 'android' }, ['tokenPush']],
    ['token vazio', { tokenPush: 'ExponentPushToken[]', plataforma: 'android' }, ['tokenPush']],
    ['plataforma ios', { tokenPush: 'ExpoPushToken[a]', plataforma: 'ios' }, ['plataforma']],
    ['sem plataforma', { tokenPush: 'ExpoPushToken[a]' }, ['plataforma']],
    ['campo extra', { tokenPush: 'ExpoPushToken[a]', plataforma: 'android', usuarioId: 'x' }, []],
  ])('rejeita %s', (_, corpo, caminho) => {
    const resultado = registrarDispositivoSchema.safeParse(corpo)
    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0]?.path).toEqual(caminho)
  })
})
