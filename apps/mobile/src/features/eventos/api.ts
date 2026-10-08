import {
  eventoCanceladoDtoSchema,
  eventoDetalheSchema,
  eventoDtoSchema,
  listaEventosSchema,
  ocorrenciasAlteradasDtoSchema,
  PeriodoEventos,
  serieCriadaDtoSchema,
  StatusEvento,
  statusEventoAlteradoDtoSchema,
  type CriarEvento,
  type CriarSerie,
  type EditarEvento,
  type EditarSeguintes,
  type EscopoOcorrencia,
  type EventoCanceladoDto,
  type EventoDetalheDto,
  type EventoDto,
  type ListaEventos,
  type ListarEventosQuery,
  type OcorrenciasAlteradasDto,
  type RegistrarResultado,
  type SerieCriadaDto,
  type StatusEventoAlteradoDto,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export const LIMITE_PAGINA = 20

/** Um status por vez: a API também aceita uma lista separada por vírgula. */
export type FiltrosEventos = Partial<Omit<ListarEventosQuery, 'page' | 'limit' | 'status'>> & {
  status?: StatusEvento
}

export async function listarEventos(
  filtros: FiltrosEventos,
  { page, limit = LIMITE_PAGINA }: { page: number; limit?: number },
  sinal?: AbortSignal,
): Promise<ListaEventos> {
  const resposta = await api.get('/eventos', {
    consulta: { ...filtros, page, limit },
    sinal,
  })
  return listaEventosSchema.parse(resposta)
}

export async function buscarEvento(id: string, sinal?: AbortSignal): Promise<EventoDetalheDto> {
  return eventoDetalheSchema.parse(await api.get(`/eventos/${id}`, { sinal }))
}

export async function criarEvento(dados: CriarEvento): Promise<EventoDto> {
  return eventoDtoSchema.parse(await api.post('/eventos', dados))
}

export async function atualizarEvento(id: string, dados: EditarEvento): Promise<EventoDto> {
  return eventoDtoSchema.parse(await api.patch(`/eventos/${id}`, dados))
}

export async function cancelarEvento(
  id: string,
  escopo?: EscopoOcorrencia,
): Promise<EventoCanceladoDto> {
  const corpo = escopo ? { escopo } : undefined
  return eventoCanceladoDtoSchema.parse(await api.post(`/eventos/${id}/cancelar`, corpo))
}

export async function alterarStatusEvento(
  id: string,
  status: StatusEvento,
): Promise<StatusEventoAlteradoDto> {
  return statusEventoAlteradoDtoSchema.parse(await api.patch(`/eventos/${id}/status`, { status }))
}

export async function registrarResultado(
  id: string,
  dados: RegistrarResultado,
): Promise<EventoDto> {
  return eventoDtoSchema.parse(await api.put(`/eventos/${id}/resultado`, dados))
}

export async function criarSerie(dados: CriarSerie): Promise<SerieCriadaDto> {
  return serieCriadaDtoSchema.parse(await api.post('/eventos', dados))
}

export async function editarSeguintes(
  id: string,
  dados: EditarSeguintes,
): Promise<OcorrenciasAlteradasDto> {
  return ocorrenciasAlteradasDtoSchema.parse(await api.patch(`/eventos/${id}`, dados))
}

/** Filtros de `GET /eventos` para as ocorrências agendadas da série a partir de `aPartirDe`. */
export function filtrosAgendadosDaSerie(serieId: string, aPartirDe: string) {
  return {
    serieId,
    status: StatusEvento.AGENDADO,
    periodo: PeriodoEventos.TODOS,
    aPartirDe,
    limit: 1,
  }
}

export async function contarAgendadosDaSerie(
  serieId: string,
  aPartirDe: string,
  sinal?: AbortSignal,
): Promise<number> {
  const consulta = filtrosAgendadosDaSerie(serieId, aPartirDe)
  const resposta = listaEventosSchema.parse(await api.get('/eventos', { consulta, sinal }))
  return resposta.total
}

export async function excluirEvento(id: string): Promise<void> {
  await api.delete(`/eventos/${id}`)
}
