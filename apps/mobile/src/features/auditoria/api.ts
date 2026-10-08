import {
  listaAuditoriaSchema,
  registroAuditoriaDetalheSchema,
  type FiltrosAuditoria,
  type ListaAuditoria,
  type RegistroAuditoriaDetalhe,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export const LIMITE_PAGINA = 20

export async function listarAuditoria(
  filtros: FiltrosAuditoria,
  page: number,
  sinal?: AbortSignal,
): Promise<ListaAuditoria> {
  const resposta = await api.get('/auditoria', {
    consulta: { ...filtros, page, limit: LIMITE_PAGINA },
    sinal,
  })
  return listaAuditoriaSchema.parse(resposta)
}

export async function buscarRegistroAuditoria(
  id: string,
  sinal?: AbortSignal,
): Promise<RegistroAuditoriaDetalhe> {
  return registroAuditoriaDetalheSchema.parse(await api.get(`/auditoria/${id}`, { sinal }))
}
