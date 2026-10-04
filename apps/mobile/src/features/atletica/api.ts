import AsyncStorage from '@react-native-async-storage/async-storage'
import { atleticaPublicaSchema, type AtleticaPublica } from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export const CHAVE_CACHE_ATLETICA = 'atletica.v1'

export async function buscarAtletica(sinal?: AbortSignal): Promise<AtleticaPublica> {
  return atleticaPublicaSchema.parse(await api.get('/atletica', { sinal }))
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
