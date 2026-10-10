import {
  estatisticasAtletaSchema,
  fotoAtualizadaSchema,
  perfilSchema,
  type AlterarSenha,
  type AtualizarPerfil,
  type EstatisticasAtleta,
  type ExcluirConta,
  type FotoAtualizada,
  type Perfil,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export async function buscarPerfil(sinal?: AbortSignal): Promise<Perfil> {
  return perfilSchema.parse(await api.get('/me', { sinal }))
}

export async function buscarEstatisticas(sinal?: AbortSignal): Promise<EstatisticasAtleta> {
  return estatisticasAtletaSchema.parse(await api.get('/me/estatisticas', { sinal }))
}

export async function atualizarPerfil(dados: AtualizarPerfil): Promise<Perfil> {
  return perfilSchema.parse(await api.patch('/me', dados))
}

export async function definirFoto(fotoKey: string): Promise<FotoAtualizada> {
  return fotoAtualizadaSchema.parse(await api.put('/me/foto', { fotoKey }))
}

export async function removerFoto(): Promise<void> {
  await api.delete('/me/foto')
}

export async function alterarSenha(dados: AlterarSenha): Promise<void> {
  await api.put('/me/senha', dados)
}

export async function excluirConta(dados: ExcluirConta): Promise<void> {
  await api.delete('/me/conta', { corpo: dados })
}
