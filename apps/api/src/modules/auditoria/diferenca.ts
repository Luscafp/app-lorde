type Registro = Record<string, unknown>

export interface DiferencaAuditoria {
  antes: Registro
  depois: Registro
}

const IGNORADOS = new Set(['criadoEm', 'atualizadoEm'])

export function ehObjetoSimples(valor: unknown): valor is Registro {
  return (
    typeof valor === 'object' && valor !== null && !Array.isArray(valor) && !(valor instanceof Date)
  )
}

function iguais(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => iguais(item, b[i]))
    )
  }
  if (ehObjetoSimples(a) && ehObjetoSimples(b)) {
    const chaves = new Set([...Object.keys(a), ...Object.keys(b)])
    return [...chaves].every((chave) => iguais(a[chave], b[chave]))
  }
  return Object.is(a, b)
}

/** Só os campos alterados (lista branca opcional); `null` se nada mudou (convenções §7). */
export function diferenca<T extends object>(
  antes: T,
  depois: T,
  campos?: readonly (keyof T & string)[],
): DiferencaAuditoria | null {
  const a = antes as Registro
  const d = depois as Registro
  const chaves = campos ?? [...new Set([...Object.keys(a), ...Object.keys(d)])]
  const resultado: DiferencaAuditoria = { antes: {}, depois: {} }
  let mudou = false

  for (const chave of chaves) {
    if (IGNORADOS.has(chave) || iguais(a[chave], d[chave])) continue
    resultado.antes[chave] = a[chave] ?? null
    resultado.depois[chave] = d[chave] ?? null
    mudou = true
  }
  return mudou ? resultado : null
}
