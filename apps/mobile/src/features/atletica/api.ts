import AsyncStorage from '@react-native-async-storage/async-storage'
import { atleticaPublicaSchema, type AtleticaPublica } from '@atletica/shared'
import { ambiente } from '@/config/ambiente'

export const CHAVE_CACHE_ATLETICA = 'atletica.v1'
const TEMPO_LIMITE_ATLETICA_MS = 3000

// Busca pública e sem token; a #52 troca pelo cliente HTTP.
export async function buscarAtletica(): Promise<AtleticaPublica> {
  const controle = new AbortController()
  const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_ATLETICA_MS)
  try {
    const resposta = await fetch(`${ambiente.apiUrl}/atletica`, {
      headers: { Accept: 'application/json' },
      signal: controle.signal,
    })
    if (!resposta.ok) throw new Error(`GET /atletica respondeu ${resposta.status}`)
    return atleticaPublicaSchema.parse(await resposta.json())
  } finally {
    clearTimeout(limite)
  }
}

export async function lerAtleticaDoCache(): Promise<AtleticaPublica | null> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_CACHE_ATLETICA)
    if (!bruto) return null
    const resultado = atleticaPublicaSchema.safeParse(JSON.parse(bruto))
    return resultado.success ? resultado.data : null
  } catch {
    return null
  }
}

export async function gravarAtleticaNoCache(atletica: AtleticaPublica): Promise<void> {
  await AsyncStorage.setItem(CHAVE_CACHE_ATLETICA, JSON.stringify(atletica))
}
