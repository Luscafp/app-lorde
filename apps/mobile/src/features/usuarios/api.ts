import {
  listaUsuariosSchema,
  papelAlteradoSchema,
  situacaoAlteradaSchema,
  usuarioDetalheSchema,
  type AlterarPapel,
  type FiltrosUsuarios,
  type ListaUsuarios,
  type PapelAlterado,
  type SituacaoAlterada,
  type UsuarioDetalhe,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export const LIMITE_PAGINA = 20

export async function listarUsuarios(
  filtros: FiltrosUsuarios,
  page: number,
  sinal?: AbortSignal,
): Promise<ListaUsuarios> {
  const resposta = await api.get('/usuarios', {
    consulta: { ...filtros, page, limit: LIMITE_PAGINA },
    sinal,
  })
  return listaUsuariosSchema.parse(resposta)
}

export async function buscarUsuario(id: string, sinal?: AbortSignal): Promise<UsuarioDetalhe> {
  return usuarioDetalheSchema.parse(await api.get(`/usuarios/${id}`, { sinal }))
}

export async function alterarSituacao(id: string, ativo: boolean): Promise<SituacaoAlterada> {
  return situacaoAlteradaSchema.parse(await api.patch(`/usuarios/${id}/status`, { ativo }))
}

export async function alterarPapel(id: string, corpo: AlterarPapel): Promise<PapelAlterado> {
  return papelAlteradoSchema.parse(await api.put(`/usuarios/${id}/papel`, corpo))
}
