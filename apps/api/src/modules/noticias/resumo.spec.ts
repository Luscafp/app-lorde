import { gerarResumo, LIMITE_RESUMO, textoPuro } from './resumo'

const grafemas = (texto: string) =>
  Array.from(new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(texto)).length

describe('textoPuro', () => {
  it.each([
    ['**negrito** e __forte__', 'negrito e forte'],
    ['*itálico* e _ênfase_', 'itálico e ênfase'],
    ['[site](https://exemplo.com) e ![capa](https://img/x.png)', 'site e capa'],
    ['# Título\n\n> citação', 'Título citação'],
    ['- um\n* dois\n+ três\n1. quatro\n2) cinco', 'um dois três quatro cinco'],
    ['~~riscado~~ e `código`', 'riscado e código'],
    ['\\*literal\\*', '*literal*'],
  ])('%j → %j', (markdown, esperado) => {
    expect(textoPuro(markdown)).toBe(esperado)
  })

  it('preserva sublinhado e asterisco dentro de palavras', () => {
    expect(textoPuro('nome_do_arquivo e 2*3*4')).toBe('nome_do_arquivo e 2*3*4')
  })

  it('normaliza quebras de linha e espaços', () => {
    expect(textoPuro('  A equipe venceu.\r\n\r\nO próximo\tdesafio  ')).toBe(
      'A equipe venceu. O próximo desafio',
    )
  })

  it('mantém HTML bruto como texto', () => {
    expect(textoPuro('<b>oi</b>')).toBe('<b>oi</b>')
  })
})

describe('gerarResumo', () => {
  it('texto curto sai inteiro, sem "…"', () => {
    expect(gerarResumo('A equipe **venceu** a final.')).toBe('A equipe venceu a final.')
  })

  it('exatamente no limite não leva "…"', () => {
    const texto = 'a'.repeat(LIMITE_RESUMO)
    expect(gerarResumo(texto)).toBe(texto)
  })

  it('texto longo é cortado em fim de palavra com "…"', () => {
    const resumo = gerarResumo('palavra '.repeat(40))
    expect(resumo.endsWith('palavra…')).toBe(true)
    expect(grafemas(resumo)).toBeLessThanOrEqual(LIMITE_RESUMO + 1)
  })

  it('corte que cai logo antes de um espaço mantém a última palavra', () => {
    const texto = `${'a'.repeat(LIMITE_RESUMO)} fim`
    expect(gerarResumo(texto)).toBe(`${'a'.repeat(LIMITE_RESUMO)}…`)
  })

  it('remove pontuação solta antes do "…"', () => {
    const resumo = gerarResumo(`${'x'.repeat(150)}, ${'y'.repeat(20)}`)
    expect(resumo).toBe(`${'x'.repeat(150)}…`)
  })

  it('palavra única maior que o limite é cortada no limite', () => {
    expect(gerarResumo('a'.repeat(300))).toBe(`${'a'.repeat(LIMITE_RESUMO)}…`)
  })

  it('a marcação não conta no limite', () => {
    const conteudo = `**${'a'.repeat(LIMITE_RESUMO)}**`
    expect(gerarResumo(conteudo)).toBe('a'.repeat(LIMITE_RESUMO))
  })

  it('não corta emojis ao meio', () => {
    const resumo = gerarResumo('👨‍👩‍👧‍👦'.repeat(200))
    expect(resumo).toBe(`${'👨‍👩‍👧‍👦'.repeat(LIMITE_RESUMO)}…`)
  })

  it('conteúdo vazio gera resumo vazio', () => {
    expect(gerarResumo('')).toBe('')
  })
})
