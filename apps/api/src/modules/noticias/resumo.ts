export const LIMITE_RESUMO = 160

const grafemas = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' })

const MARCACOES: [RegExp, string][] = [
  [/!\[([^\]]*)\]\([^)]*\)/g, '$1'],
  [/\[([^\]]*)\]\([^)]*\)/g, '$1'],
  [/^ {0,3}#{1,6}\s+/gm, ''],
  [/^ {0,3}>\s?/gm, ''],
  [/^\s*(?:[-*+]|\d+[.)])\s+/gm, ''],
  [/(\*\*|__)(.+?)\1/g, '$2'],
  [/(?<![\w*])\*(?!\s)(.+?)\*(?![\w*])/g, '$1'],
  [/(?<!\w)_(?!\s)(.+?)_(?!\w)/g, '$1'],
  [/~~(.+?)~~/g, '$1'],
  [/`([^`]*)`/g, '$1'],
]

/** Caracteres escapados (`\*`) viram a área de uso privado para escapar das marcações. */
const ESCAPADO = /\\([\\`*_{}[\]()#+\-.!>~])/g
const USO_PRIVADO = 0xe000
const PROTEGIDO = /[-]/g

const proteger = (texto: string) =>
  texto.replace(ESCAPADO, (_, c: string) => String.fromCharCode(USO_PRIVADO + c.charCodeAt(0)))

const restaurar = (texto: string) =>
  texto.replace(PROTEGIDO, (c) => String.fromCharCode(c.charCodeAt(0) - USO_PRIVADO))

/** Remove a marcação do Markdown restrito e junta as linhas num parágrafo só. */
export function textoPuro(markdown: string): string {
  const semMarcacao = MARCACOES.reduce(
    (texto, [padrao, troca]) => texto.replace(padrao, troca),
    proteger(markdown),
  )
  return restaurar(semMarcacao).replace(/\s+/g, ' ').trim()
}

/** Até `LIMITE_RESUMO` caracteres visíveis, cortado em fim de palavra e terminado em "…". */
export function gerarResumo(conteudo: string): string {
  const texto = textoPuro(conteudo)
  const partes = Array.from(grafemas.segment(texto), ({ segment }) => segment)
  if (partes.length <= LIMITE_RESUMO) return texto

  const comProximo = partes.slice(0, LIMITE_RESUMO + 1).join('')
  const ultimoEspaco = comProximo.lastIndexOf(' ')
  const corte =
    ultimoEspaco > 0 ? comProximo.slice(0, ultimoEspaco) : partes.slice(0, LIMITE_RESUMO).join('')
  return `${corte.replace(/[\s,;:.!?-]+$/, '')}…`
}
