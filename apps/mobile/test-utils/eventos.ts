import type { EventoResumoDto, ListaEventos } from '@atletica/shared'

export const eventoResumo = (
  id: string,
  parcial: Partial<EventoResumoDto> = {},
): EventoResumoDto => ({
  id,
  tipo: 'TREINO',
  status: 'AGENDADO',
  inicio: '2030-10-09T22:00:00.000Z',
  local: 'Ginásio',
  serieId: null,
  time: { id: 't1', nome: 'Futsal Masculino' },
  modalidade: { id: 'm1', nome: 'Futsal', icone: 'soccer' },
  timeAdversario: null,
  placarTime: null,
  placarAdversario: null,
  resultado: null,
  souMembro: false,
  minhaParticipacao: null,
  ...parcial,
})

export const paginaEventos = (items: EventoResumoDto[], limit = 5): ListaEventos => ({
  items,
  page: 1,
  limit,
  total: items.length,
})
