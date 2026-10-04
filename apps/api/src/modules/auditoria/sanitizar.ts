import { ehObjetoSimples } from './diferenca'

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

/** Onde `nome` é o da própria entidade auditada, não de uma pessoa. */
const CAMINHOS_NOME_DA_ENTIDADE: ReadonlySet<string> = new Set(['antes.nome', 'depois.nome'])

export interface ResultadoSanitizacao<T> {
  valor: T
  /** Caminhos removidos (ex.: `depois.email`), sem os valores. */
  removidos: string[]
}

function proibido(chave: string, caminho: string, nomeDeDominio: boolean): boolean {
  if (nomeDeDominio && CAMINHOS_NOME_DA_ENTIDADE.has(caminho)) return false
  return CAMPOS_PROIBIDOS.has(chave) || chave.endsWith('Hash')
}

function limpar(
  valor: unknown,
  caminho: string,
  nomeDeDominio: boolean,
  removidos: string[],
): unknown {
  if (Array.isArray(valor)) {
    return valor.map((item, i) => limpar(item, `${caminho}[${i}]`, nomeDeDominio, removidos))
  }
  if (!ehObjetoSimples(valor)) return valor

  const resultado: Record<string, unknown> = {}
  for (const [chave, item] of Object.entries(valor)) {
    const atual = caminho ? `${caminho}.${chave}` : chave
    if (proibido(chave, atual, nomeDeDominio)) removidos.push(atual)
    else resultado[chave] = limpar(item, atual, nomeDeDominio, removidos)
  }
  return resultado
}

/** Remove os campos proibidos em qualquer nível; `nomeDeDominio` mantém `antes.nome`/`depois.nome`. */
export function sanitizar<T>(valor: T, nomeDeDominio = false): ResultadoSanitizacao<T> {
  const removidos: string[] = []
  return { valor: limpar(valor, '', nomeDeDominio, removidos) as T, removidos }
}
