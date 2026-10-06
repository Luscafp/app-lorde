import {
  atleticaAdversariaDtoSchema,
  listaAtleticasAdversariasSchema,
  listaTimesSchema,
  timeDtoSchema,
  type AtleticaAdversaria,
  type AtleticaAdversariaAtualizacao,
  type AtleticaAdversariaCriacao,
  type ListaAtleticasAdversarias,
  type ListaTimes,
  type TimeAtualizacao,
  type TimeCriacao,
  type TimeDto,
  type TimesQuery,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export const LIMITE_PAGINA = 20

export type FiltrosTimes = Partial<Omit<TimesQuery, 'page' | 'limit'>>

export async function listarTimes(
  filtros: FiltrosTimes,
  page: number,
  sinal?: AbortSignal,
): Promise<ListaTimes> {
  const resposta = await api.get('/times', {
    consulta: { ...filtros, page, limit: LIMITE_PAGINA },
    sinal,
  })
  return listaTimesSchema.parse(resposta)
}

export async function buscarTime(id: string, sinal?: AbortSignal): Promise<TimeDto> {
  return timeDtoSchema.parse(await api.get(`/times/${id}`, { sinal }))
}

export async function criarTime(dados: TimeCriacao): Promise<TimeDto> {
  return timeDtoSchema.parse(await api.post('/times', dados))
}

export async function atualizarTime(id: string, dados: TimeAtualizacao): Promise<TimeDto> {
  return timeDtoSchema.parse(await api.patch(`/times/${id}`, dados))
}

export async function excluirTime(id: string): Promise<void> {
  await api.delete(`/times/${id}`)
}

export async function listarAtleticasAdversarias(
  q: string | undefined,
  page: number,
  sinal?: AbortSignal,
): Promise<ListaAtleticasAdversarias> {
  const resposta = await api.get('/atleticas-adversarias', {
    consulta: { q, page, limit: LIMITE_PAGINA },
    sinal,
  })
  return listaAtleticasAdversariasSchema.parse(resposta)
}

export async function criarAtleticaAdversaria(
  dados: AtleticaAdversariaCriacao,
): Promise<AtleticaAdversaria> {
  return atleticaAdversariaDtoSchema.parse(await api.post('/atleticas-adversarias', dados))
}

export async function atualizarAtleticaAdversaria(
  id: string,
  dados: AtleticaAdversariaAtualizacao,
): Promise<AtleticaAdversaria> {
  return atleticaAdversariaDtoSchema.parse(await api.patch(`/atleticas-adversarias/${id}`, dados))
}
