import {
  listaModalidadesSchema,
  modalidadeSchema,
  type Modalidade,
  type ModalidadeAtualizacao,
  type ModalidadeCriacao,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export type FiltroModalidades = { incluirInativas?: boolean }

export async function buscarModalidades(
  { incluirInativas = false }: FiltroModalidades,
  sinal?: AbortSignal,
): Promise<Modalidade[]> {
  const resposta = await api.get('/modalidades', { consulta: { incluirInativas }, sinal })
  return listaModalidadesSchema.parse(resposta).items
}

export async function criarModalidade(dados: ModalidadeCriacao): Promise<Modalidade> {
  return modalidadeSchema.parse(await api.post('/modalidades', dados))
}

export async function atualizarModalidade(
  id: string,
  dados: ModalidadeAtualizacao,
): Promise<Modalidade> {
  return modalidadeSchema.parse(await api.patch(`/modalidades/${id}`, dados))
}

export async function excluirModalidade(id: string): Promise<void> {
  await api.delete(`/modalidades/${id}`)
}
