import * as SecureStore from 'expo-secure-store'

/** Refresh tokens de logouts feitos sem resposta da API, reenviados quando a conexão volta. */
export const CHAVE_LOGOUT_PENDENTE = 'auth.logoutPendente'

let fila: Promise<unknown> = Promise.resolve()

/** Leitura e escrita em série: adicionar e remover ao mesmo tempo não perdem tokens. */
function emSerie<T>(operacao: () => Promise<T>): Promise<T> {
  const resultado = fila.then(operacao)
  fila = resultado.catch(() => undefined)
  return resultado
}

async function ler(): Promise<string[]> {
  try {
    const bruto = await SecureStore.getItemAsync(CHAVE_LOGOUT_PENDENTE)
    const valor: unknown = bruto ? JSON.parse(bruto) : []
    return Array.isArray(valor) ? valor.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

async function gravar(tokens: string[]): Promise<void> {
  if (tokens.length === 0) await SecureStore.deleteItemAsync(CHAVE_LOGOUT_PENDENTE)
  else await SecureStore.setItemAsync(CHAVE_LOGOUT_PENDENTE, JSON.stringify(tokens))
}

export function listarLogoutPendente(): Promise<string[]> {
  return emSerie(ler)
}

export function adicionarLogoutPendente(refreshToken: string): Promise<void> {
  return emSerie(async () => {
    const tokens = await ler()
    if (!tokens.includes(refreshToken)) await gravar([...tokens, refreshToken])
  })
}

export function removerLogoutPendente(refreshToken: string): Promise<void> {
  return emSerie(async () => gravar((await ler()).filter((token) => token !== refreshToken)))
}
