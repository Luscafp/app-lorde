import {
  dispositivoRegistradoSchema,
  preferenciasSchema,
  type AtualizarPreferencias,
  type DispositivoRegistrado,
  type Preferencias,
  type RegistrarDispositivo,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

const ROTA = '/me/preferencias-notificacao'
const ROTA_DISPOSITIVOS = '/me/dispositivos'

export async function buscarPreferencias(sinal?: AbortSignal): Promise<Preferencias> {
  return preferenciasSchema.parse(await api.get(ROTA, { sinal }))
}

export async function atualizarPreferencias(dados: AtualizarPreferencias): Promise<Preferencias> {
  return preferenciasSchema.parse(await api.patch(ROTA, dados))
}

export async function registrarDispositivo(
  dados: RegistrarDispositivo,
): Promise<DispositivoRegistrado> {
  return dispositivoRegistradoSchema.parse(await api.post(ROTA_DISPOSITIVOS, dados))
}

export async function excluirDispositivo(id: string, sinal?: AbortSignal): Promise<void> {
  await api.delete(`${ROTA_DISPOSITIVOS}/${id}`, { sinal })
}
