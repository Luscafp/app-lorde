import AsyncStorage from '@react-native-async-storage/async-storage'
import { atleticaPublicaSchema, type AtleticaPublica } from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export const CHAVE_CACHE_ATLETICA = 'atletica.v1'
export const CHAVE_CACHE_ATLETICA_SALVA_EM = 'atletica.v1.salvaEm'

export type AtleticaEmCache = { atletica: AtleticaPublica; salvaEm: number }

export async function buscarAtletica(sinal?: AbortSignal): Promise<AtleticaPublica> {
  return atleticaPublicaSchema.parse(await api.get('/atletica', { sinal }))
}

/** Cache gravado antes do `salvaEm` volta com `salvaEm: 0`. */
export async function lerAtleticaDoCache(): Promise<AtleticaEmCache | null> {
  try {
    const [bruto, salvaEm] = await Promise.all([
      AsyncStorage.getItem(CHAVE_CACHE_ATLETICA),
      AsyncStorage.getItem(CHAVE_CACHE_ATLETICA_SALVA_EM),
    ])
    if (!bruto) return null
    const resultado = atleticaPublicaSchema.safeParse(JSON.parse(bruto))
    if (!resultado.success) return null
    return { atletica: resultado.data, salvaEm: Number(salvaEm) || 0 }
  } catch {
    return null
  }
}

export async function gravarAtleticaNoCache(atletica: AtleticaPublica): Promise<void> {
  await AsyncStorage.multiSet([
    [CHAVE_CACHE_ATLETICA, JSON.stringify(atletica)],
    [CHAVE_CACHE_ATLETICA_SALVA_EM, String(Date.now())],
  ])
}
