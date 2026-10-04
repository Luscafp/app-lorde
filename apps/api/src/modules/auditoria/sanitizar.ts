/** Campos que nunca vão para a auditoria, além de qualquer `*Hash` (convenções §7). */
export const CAMPOS_PROIBIDOS: ReadonlySet<string> = new Set([
  'senhaHash',
  'refreshTokenHash',
  'refreshTokenAnteriorHash',
  'codigoHash',
  'tokenPush',
  'email',
  'nome',
  'fotoKey',
  'ip',
  'userAgent',
  'accessToken',
  'refreshToken',
])

export interface ResultadoSanitizacao<T> {
  valor: T
  /** Caminhos removidos (ex.: `depois.email`), sem os valores. */
  removidos: string[]
}

function proibido(chave: string, permitidos: ReadonlySet<string>): boolean {
  if (permitidos.has(chave)) return false
  return CAMPOS_PROIBIDOS.has(chave) || chave.endsWith('Hash')
}

function limpar(
  valor: unknown,
  caminho: string,
  permitidos: ReadonlySet<string>,
  removidos: string[],
): unknown {
  if (Array.isArray(valor)) {
    return valor.map((item, i) => limpar(item, `${caminho}[${i}]`, permitidos, removidos))
  }
  if (typeof valor !== 'object' || valor === null || valor instanceof Date) return valor

  const resultado: Record<string, unknown> = {}
  for (const [chave, item] of Object.entries(valor)) {
    const atual = caminho ? `${caminho}.${chave}` : chave
    if (proibido(chave, permitidos)) removidos.push(atual)
    else resultado[chave] = limpar(item, atual, permitidos, removidos)
  }
  return resultado
}

/** Remove os campos proibidos em qualquer nível; `permitidos` libera nomes de domínio (ex.: `nome` de um time). */
export function sanitizar<T>(
  valor: T,
  permitidos: ReadonlySet<string> = new Set(),
): ResultadoSanitizacao<T> {
  const removidos: string[] = []
  return { valor: limpar(valor, '', permitidos, removidos) as T, removidos }
}
