import { preferenciasSchema, type AtualizarPreferencias, type Preferencias } from '@atletica/shared'
import { api } from '@/infra/api/cliente'

const ROTA = '/me/preferencias-notificacao'

export async function buscarPreferencias(sinal?: AbortSignal): Promise<Preferencias> {
  return preferenciasSchema.parse(await api.get(ROTA, { sinal }))
}

export async function atualizarPreferencias(dados: AtualizarPreferencias): Promise<Preferencias> {
  return preferenciasSchema.parse(await api.patch(ROTA, dados))
}
