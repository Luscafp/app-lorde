/** `"10102026"` → `"10/10/2026"`. */
export function mascararData(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8)
  return [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4)].filter(Boolean).join('/')
}

/** `"1930"` → `"19:30"`. */
export function mascararHora(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 4)
  return [digitos.slice(0, 2), digitos.slice(2)].filter(Boolean).join(':')
}
