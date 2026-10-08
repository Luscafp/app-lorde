const BRANCO = '#FFFFFF'
const PRETO = '#000000'

function canais(hex: string): [number, number, number] {
  const valor = /^#([0-9a-f]{6})$/i.exec(hex)?.[1]
  if (!valor) throw new Error(`Cor inválida: ${hex}`)
  const numero = parseInt(valor, 16)
  return [(numero >> 16) & 255, (numero >> 8) & 255, numero & 255]
}

/** `#E11D48` → `'225 29 72'`, formato das variáveis `--cor-*` do NativeWind. */
export function hexParaRgb(hex: string): string {
  return canais(hex).join(' ')
}

function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((canal) => {
    const c = canal / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Branco ou preto, o que tiver maior contraste WCAG sobre `hex`. */
export function corTextoSobre(hex: string): typeof BRANCO | typeof PRETO {
  const luz = luminancia(hex)
  const contrasteBranco = 1.05 / (luz + 0.05)
  const contrastePreto = (luz + 0.05) / 0.05
  return contrasteBranco >= contrastePreto ? BRANCO : PRETO
}

/** Fundo translúcido de chips e destaques: `#E11D48` → `'#E11D4822'`. */
export function comAlfa(hex: string): string {
  return `${hex}22`
}
