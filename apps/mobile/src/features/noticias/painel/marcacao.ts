export type Selecao = { start: number; end: number }

export type Marcacao = 'negrito' | 'italico' | 'lista' | 'link'

const ENVOLTORIOS: Record<Exclude<Marcacao, 'lista'>, [string, string]> = {
  negrito: ['**', '**'],
  italico: ['_', '_'],
  link: ['[', '](https://)'],
}

const TEXTO_PADRAO = 'texto'
const ITEM_LISTA = '- '

/** Aplica a marcação do subconjunto aceito pelo `ConteudoMarkdown` (#78). */
export function aplicarMarcacao(
  texto: string,
  { start, end }: Selecao,
  marcacao: Marcacao,
): { texto: string; cursor: number } {
  if (marcacao === 'lista') {
    const inicioLinha = texto.lastIndexOf('\n', start - 1) + 1
    return {
      texto: texto.slice(0, inicioLinha) + ITEM_LISTA + texto.slice(inicioLinha),
      cursor: end + ITEM_LISTA.length,
    }
  }
  const [antes, depois] = ENVOLTORIOS[marcacao]
  const trecho = texto.slice(start, end) || TEXTO_PADRAO
  const inserido = antes + trecho + depois
  return {
    texto: texto.slice(0, start) + inserido + texto.slice(end),
    cursor: start + inserido.length,
  }
}
