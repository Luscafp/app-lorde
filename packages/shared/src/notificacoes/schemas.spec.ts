import { preferenciasSchema } from './dtos'
import {
  alcanceAvisoQuerySchema,
  atualizarPreferenciasSchema,
  avisoDoFormulario,
  avisoFormSchema,
  enviarAvisoSchema,
  registrarDispositivoSchema,
} from './schemas'

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

const TIME_ID = '7c1e2a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const TEXTO = { titulo: 'Treino cancelado hoje', mensagem: 'Por causa da chuva, sem treino.' }

describe('enviarAvisoSchema', () => {
  it('aceita TODOS e TIME, com trim', () => {
    expect(
      enviarAvisoSchema.parse({ destino: 'TODOS', titulo: '  Aviso  ', mensagem: ' Oi! ' }),
    ).toEqual({ destino: 'TODOS', titulo: 'Aviso', mensagem: 'Oi!' })
    const time = { destino: 'TIME', timeId: TIME_ID, ...TEXTO }
    expect(enviarAvisoSchema.parse(time)).toEqual(time)
  })

  it.each([
    ['TIME sem timeId', { destino: 'TIME', ...TEXTO }, ['timeId']],
    ['timeId inválido', { destino: 'TIME', timeId: 'x', ...TEXTO }, ['timeId']],
    [
      'título com 66 caracteres',
      { destino: 'TODOS', ...TEXTO, titulo: 'x'.repeat(66) },
      ['titulo'],
    ],
    ['título só com espaços', { destino: 'TODOS', ...TEXTO, titulo: '     ' }, ['titulo']],
    ['mensagem vazia', { destino: 'TODOS', ...TEXTO, mensagem: '' }, ['mensagem']],
    ['mensagem com 501', { destino: 'TODOS', ...TEXTO, mensagem: 'x'.repeat(501) }, ['mensagem']],
    ['destino inválido', { destino: 'GRUPO', ...TEXTO }, ['destino']],
    ['timeId com TODOS', { destino: 'TODOS', timeId: TIME_ID, ...TEXTO }, []],
  ])('rejeita %s', (_, corpo, caminho) => {
    const resultado = enviarAvisoSchema.safeParse(corpo)
    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0]?.path).toEqual(caminho)
  })

  it('aceita os limites exatos (65 e 500)', () => {
    const corpo = { destino: 'TODOS', titulo: 'x'.repeat(65), mensagem: 'y'.repeat(500) }
    expect(enviarAvisoSchema.safeParse(corpo).success).toBe(true)
  })
})

describe('alcanceAvisoQuerySchema', () => {
  it.each([[{ destino: 'TODOS' }], [{ destino: 'TIME', timeId: TIME_ID }]])(
    'aceita %o',
    (consulta) => {
      expect(alcanceAvisoQuerySchema.parse(consulta)).toEqual(consulta)
    },
  )

  it.each([
    ['TIME sem timeId', { destino: 'TIME' }, ['timeId']],
    ['TODOS com timeId', { destino: 'TODOS', timeId: TIME_ID }, ['timeId']],
    ['destino inválido', { destino: 'GRUPO' }, ['destino']],
  ])('rejeita %s', (_, consulta, caminho) => {
    expect(alcanceAvisoQuerySchema.safeParse(consulta).error?.issues[0]?.path).toEqual(caminho)
  })
})

describe('avisoFormSchema e avisoDoFormulario', () => {
  it('TIME sem time escolhido: erro em timeId', () => {
    const resultado = avisoFormSchema.safeParse({ destino: 'TIME', timeId: '', ...TEXTO })
    expect(resultado.error?.issues.map(({ path }) => path)).toEqual([['timeId']])
  })

  it('TODOS descarta o time escolhido antes', () => {
    const dados = avisoFormSchema.parse({ destino: 'TODOS', timeId: TIME_ID, ...TEXTO })
    expect(avisoDoFormulario(dados)).toEqual({ destino: 'TODOS', ...TEXTO })
  })

  it('TIME leva o timeId', () => {
    const dados = avisoFormSchema.parse({ destino: 'TIME', timeId: TIME_ID, ...TEXTO })
    expect(enviarAvisoSchema.parse(avisoDoFormulario(dados))).toEqual({
      destino: 'TIME',
      timeId: TIME_ID,
      ...TEXTO,
    })
  })
})
