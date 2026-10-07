import type { EventoResumoDto, ListaEventos, Modalidade } from '@atletica/shared'
import {
  onlineManager,
  QueryClientProvider,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useState, type ReactElement, type ReactNode } from 'react'
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import {
  EventoCard,
  lerParametros,
  MinhaRespostaChip,
  TelaAgenda,
  tituloEvento,
  type AbaAgenda,
  type FiltrosSelecionados,
} from '@/features/eventos'
import { agruparPorDia } from '@/features/eventos/agenda'
import * as apiEventos from '@/features/eventos/api'
import { rotuloDia } from '@/features/eventos/formatacao'
import * as apiModalidades from '@/features/modalidades/api'
import { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'

jest.mock('@/features/eventos/api', () => ({ LIMITE_PAGINA: 20, listarEventos: jest.fn() }))
jest.mock('@/features/modalidades/api')

const listarEventos = jest.mocked(apiEventos.listarEventos)
const buscarModalidades = jest.mocked(apiModalidades.buscarModalidades)

const VOLEI: Modalidade = {
  id: '5a0c7d1e-2b3f-4c5d-8e9f-0a1b2c3d4e5f',
  nome: 'Vôlei',
  icone: 'volleyball',
  ativa: true,
}

const evento = (id: string, parcial: Partial<EventoResumoDto> = {}): EventoResumoDto => ({
  id,
  tipo: 'JOGO',
  status: 'AGENDADO',
  inicio: '2030-10-09T22:00:00.000Z',
  local: 'Ginásio Castelinho',
  serieId: null,
  time: { id: 't1', nome: 'Lorde Vôlei' },
  modalidade: { id: VOLEI.id, nome: 'Vôlei', icone: 'volleyball' },
  timeAdversario: {
    id: 't2',
    nome: 'Vôlei Masculino',
    atletica: { id: 'a2', nome: 'Atlética Medicina', sigla: 'AAMED' },
  },
  placarTime: null,
  placarAdversario: null,
  resultado: null,
  souMembro: false,
  minhaParticipacao: null,
  ...parcial,
})

const treino = (id: string, parcial: Partial<EventoResumoDto> = {}) =>
  evento(id, { tipo: 'TREINO', timeAdversario: null, ...parcial })

const pagina = (items: EventoResumoDto[], page = 1, total = items.length): ListaEventos => ({
  items,
  page,
  limit: 20,
  total,
})

let cliente: QueryClient

function Provedor({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

const renderizar = (elemento: ReactElement) => render(elemento, { wrapper: Provedor })

const aoAbrirEvento = jest.fn()
const aoMudarAba = jest.fn()

/** Como a rota: filtros controlados de fora. */
function Agenda({
  inicial = {},
  aba = 'eventos',
}: {
  inicial?: FiltrosSelecionados
  aba?: AbaAgenda
}) {
  const [filtros, setFiltros] = useState(inicial)
  return (
    <TelaAgenda
      aba={aba}
      aoMudarAba={aoMudarAba}
      filtros={filtros}
      aoMudarFiltros={setFiltros}
      aoAbrirEvento={aoAbrirEvento}
    />
  )
}

const estiloDe = (texto: string): TextStyle =>
  StyleSheet.flatten(screen.getByText(texto).props.style as StyleProp<TextStyle>) ?? {}

const consultasFeitas = () => listarEventos.mock.calls.map(([filtros, page]) => ({ filtros, page }))

beforeEach(() => {
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  onlineManager.setOnline(true)
  jest.clearAllMocks()
  listarEventos.mockReset()
  buscarModalidades.mockResolvedValue([VOLEI])
})

afterEach(() => {
  cliente.clear()
})

describe('agrupamento e rótulos de dia', () => {
  it('evento às 23:30 local (02:30Z do dia seguinte) fica no dia local', () => {
    const tarde = evento('a', { inicio: '2026-10-14T12:00:00.000Z' })
    const noite = evento('b', { inicio: '2026-10-15T02:30:00.000Z' })
    const seguinte = evento('c', { inicio: '2026-10-15T03:00:00.000Z' })

    expect(agruparPorDia([tarde, noite, seguinte])).toEqual([
      { dia: '2026-10-14', eventos: [tarde, noite] },
      { dia: '2026-10-15', eventos: [seguinte] },
    ])
  })

  it.each([
    ['2026-10-13', 'Hoje'],
    ['2026-10-14', 'Amanhã'],
    ['2026-10-15', 'qui, 15/10'],
    ['2026-10-12', 'seg, 12/10'],
  ])('%s → %s (agora: 13/10 12:00 local)', (dia, rotulo) => {
    expect(rotuloDia(dia, '2026-10-13T15:00:00.000Z')).toBe(rotulo)
  })

  it('"Hoje" segue o dia local: 01:00Z de 14/10 ainda é 13/10 em Fortaleza', () => {
    expect(rotuloDia('2026-10-13', '2026-10-14T01:00:00.000Z')).toBe('Hoje')
    expect(rotuloDia('2026-10-14', '2026-10-14T01:00:00.000Z')).toBe('Amanhã')
  })

  it('Amanhã atravessa o fim do mês e do ano', () => {
    expect(rotuloDia('2026-11-01', '2026-10-31T15:00:00.000Z')).toBe('Amanhã')
    expect(rotuloDia('2027-01-01', '2026-12-31T15:00:00.000Z')).toBe('Amanhã')
  })
})

describe('lerParametros', () => {
  it('lê segmento e filtros válidos', () => {
    expect(lerParametros({ aba: 'placar', tipo: 'JOGO', modalidadeId: VOLEI.id })).toEqual({
      aba: 'placar',
      filtros: { tipo: 'JOGO', modalidadeId: VOLEI.id },
    })
  })

  it('valores inválidos viram o padrão', () => {
    expect(lerParametros({ aba: 'outra', tipo: 'AMISTOSO', modalidadeId: 'volei' })).toEqual({
      aba: 'eventos',
      filtros: { tipo: undefined, modalidadeId: undefined },
    })
  })
})

describe('EventoCard', () => {
  it('jogo: "<time> × <atlética adversária>", chips, data/hora local e local', async () => {
    const aoAbrir = jest.fn()
    const jogo = evento('a')
    await renderizar(<EventoCard evento={jogo} aoAbrir={aoAbrir} />)

    expect(screen.getByText('Lorde Vôlei × Atlética Medicina')).toBeOnTheScreen()
    expect(screen.getByText('JOGO')).toBeOnTheScreen()
    expect(screen.getByText('Vôlei')).toBeOnTheScreen()
    expect(screen.getByText('09/10/2030 19:00 · Ginásio Castelinho')).toBeOnTheScreen()
    expect(screen.queryByText('CANCELADO')).toBeNull()

    await fireEvent.press(screen.getByRole('button', { name: /^Lorde Vôlei × Atlética Medicina/ }))
    expect(aoAbrir).toHaveBeenCalledWith(jogo)
  })

  it('treino: "Treino — <time>"', async () => {
    await renderizar(<EventoCard evento={treino('a')} aoAbrir={jest.fn()} />)
    expect(screen.getByText('Treino — Lorde Vôlei')).toBeOnTheScreen()
    expect(screen.getByText('TREINO')).toBeOnTheScreen()
  })

  it('cancelado: chip "CANCELADO" e título riscado (UC02 A2)', async () => {
    await renderizar(
      <EventoCard evento={evento('a', { status: 'CANCELADO' })} aoAbrir={jest.fn()} />,
    )
    expect(screen.getByText('CANCELADO')).toBeOnTheScreen()
    expect(estiloDe('Lorde Vôlei × Atlética Medicina')).toMatchObject({
      textDecorationLine: 'line-through',
    })
    expect(
      screen.getByRole('button', { name: /^Lorde Vôlei × Atlética Medicina, CANCELADO,/ }),
    ).toBeOnTheScreen()
  })

  it('em andamento: chip "EM ANDAMENTO", título sem risco', async () => {
    await renderizar(
      <EventoCard evento={evento('a', { status: 'EM_ANDAMENTO' })} aoAbrir={jest.fn()} />,
    )
    expect(screen.getByText('EM ANDAMENTO')).toBeOnTheScreen()
    expect(estiloDe('Lorde Vôlei × Atlética Medicina').textDecorationLine).toBeUndefined()
  })

  it('tituloEvento sem adversário em jogo usa travessão', () => {
    expect(tituloEvento({ ...evento('a'), timeAdversario: null })).toBe('Lorde Vôlei × —')
  })
})

describe('MinhaRespostaChip', () => {
  const respondido = (confirmado: boolean) => ({
    confirmado,
    respondidoEm: '2030-10-01T12:00:00.000Z',
  })

  it.each([
    ['VOU', respondido(true)],
    ['NÃO VOU', respondido(false)],
    ['RESPONDER', null],
  ])('membro de evento agendado → %s', async (texto, minhaParticipacao) => {
    await renderizar(
      <MinhaRespostaChip evento={evento('a', { souMembro: true, minhaParticipacao })} />,
    )
    expect(screen.getByText(texto)).toBeOnTheScreen()
  })

  it.each([
    ['não membro', { souMembro: false }],
    ['cancelado', { souMembro: true, status: 'CANCELADO' as const }],
    ['em andamento', { souMembro: true, status: 'EM_ANDAMENTO' as const }],
  ])('%s → nada', async (_caso, parcial) => {
    await renderizar(<MinhaRespostaChip evento={evento('a', parcial)} />)
    for (const texto of ['VOU', 'NÃO VOU', 'RESPONDER'])
      expect(screen.queryByText(texto)).toBeNull()
  })
})

describe('Aba Agenda', () => {
  it('próximos agrupados por dia, com chip de resposta, e abre o card (critério 1)', async () => {
    const primeiro = evento('a', { souMembro: true })
    const segundo = treino('b', { inicio: '2030-10-11T02:30:00.000Z' })
    listarEventos.mockResolvedValue(pagina([primeiro, segundo]))
    await renderizar(<Agenda />)

    expect(await screen.findByText('Lorde Vôlei × Atlética Medicina')).toBeOnTheScreen()
    expect(screen.getByRole('header', { name: 'qua, 09/10' })).toBeOnTheScreen()
    expect(screen.getByRole('header', { name: 'qui, 10/10' })).toBeOnTheScreen()
    expect(screen.getByText('RESPONDER')).toBeOnTheScreen()
    expect(consultasFeitas()).toEqual([{ filtros: { periodo: 'PROXIMOS' }, page: 1 }])

    await fireEvent.press(screen.getByRole('button', { name: /^Treino — Lorde Vôlei/ }))
    expect(aoAbrirEvento).toHaveBeenCalledWith(segundo)
    const listas = cliente.getQueriesData<InfiniteData<ListaEventos>>({
      queryKey: chaves.eventos.todos(),
    })
    expect(
      listas.flatMap(([, dados]) => dados?.pages.flatMap(({ items }) => items) ?? []),
    ).toContainEqual(segundo)
  })

  it('filtros de tipo e modalidade combinados vão para a API (critérios 3 e 4)', async () => {
    listarEventos.mockResolvedValue(pagina([evento('a')]))
    await renderizar(<Agenda />)
    await screen.findByText('Lorde Vôlei × Atlética Medicina')

    await fireEvent.press(screen.getByRole('radio', { name: 'Jogos' }))
    await fireEvent.press(await screen.findByRole('radio', { name: 'Vôlei' }))

    await waitFor(() =>
      expect(consultasFeitas().at(-1)).toEqual({
        filtros: { periodo: 'PROXIMOS', tipo: 'JOGO', modalidadeId: VOLEI.id },
        page: 1,
      }),
    )
    expect(screen.getByRole('radio', { name: 'Jogos' })).toBeSelected()
    expect(screen.getByRole('radio', { name: 'Vôlei' })).toBeSelected()

    await fireEvent.press(screen.getByRole('radio', { name: 'Treinos' }))
    await waitFor(() =>
      expect(consultasFeitas().at(-1)?.filtros).toEqual({
        periodo: 'PROXIMOS',
        tipo: 'TREINO',
        modalidadeId: VOLEI.id,
      }),
    )
  })

  it('filtros sem resultado: mensagem e "Limpar filtros" volta a Todos/Todas (critério 5)', async () => {
    listarEventos.mockImplementation((filtros) =>
      Promise.resolve(pagina(filtros.tipo ? [] : [evento('a')])),
    )
    await renderizar(<Agenda inicial={{ tipo: 'TREINO', modalidadeId: VOLEI.id }} />)

    expect(await screen.findByText('Nenhum evento para os filtros escolhidos')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Limpar filtros' }))

    expect(await screen.findByText('Lorde Vôlei × Atlética Medicina')).toBeOnTheScreen()
    expect(consultasFeitas().at(-1)?.filtros).toEqual({ periodo: 'PROXIMOS' })
    expect(screen.getByRole('radio', { name: 'Todos' })).toBeSelected()
    expect(screen.getByRole('radio', { name: 'Todas' })).toBeSelected()
  })

  it('sem eventos e sem filtros: "Nenhum evento agendado", sem "Limpar filtros" (critério 6)', async () => {
    listarEventos.mockResolvedValue(pagina([]))
    await renderizar(<Agenda />)

    expect(await screen.findByText('Nenhum evento agendado')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull()
  })

  it('45 próximos: rolar até o fim carrega as páginas 2 e 3 (critério 10)', async () => {
    const todos = Array.from({ length: 45 }, (_, i) => evento(`e${i}`))
    listarEventos.mockImplementation((_filtros, page) =>
      Promise.resolve(pagina(todos.slice((page - 1) * 20, page * 20), page, 45)),
    )
    await renderizar(<Agenda />)
    await screen.findAllByText('Lorde Vôlei × Atlética Medicina')

    await fireEvent(screen.getByTestId('lista-agenda'), 'endReached')
    await waitFor(() => expect(consultasFeitas()).toHaveLength(2))
    await fireEvent(screen.getByTestId('lista-agenda'), 'endReached')
    await waitFor(() => expect(consultasFeitas()).toHaveLength(3))

    expect(consultasFeitas().map(({ page }) => page)).toEqual([1, 2, 3])
    await fireEvent(screen.getByTestId('lista-agenda'), 'endReached')
    expect(consultasFeitas()).toHaveLength(3)
  })

  it('páginas repetindo um item não duplicam o card', async () => {
    listarEventos
      .mockResolvedValueOnce(pagina([evento('a'), treino('b')], 1, 21))
      .mockResolvedValueOnce(pagina([treino('b'), treino('c', { local: 'Quadra' })], 2, 21))
    await renderizar(<Agenda />)
    await screen.findByText('Lorde Vôlei × Atlética Medicina')

    await fireEvent(screen.getByTestId('lista-agenda'), 'endReached')

    expect(await screen.findByText('09/10/2030 19:00 · Quadra')).toBeOnTheScreen()
    expect(screen.getAllByText('Treino — Lorde Vôlei')).toHaveLength(2)
  })

  it('carregando: esqueleto', async () => {
    listarEventos.mockReturnValue(new Promise(() => {}))
    await renderizar(<Agenda />)
    expect(screen.getByLabelText('Carregando')).toBeOnTheScreen()
  })

  it('erro: "Não foi possível carregar a agenda" e "Tentar novamente" (critério 20)', async () => {
    listarEventos
      .mockRejectedValueOnce(new ApiErro({ status: 500, code: 'INTERNAL_ERROR', message: 'x' }))
      .mockResolvedValue(pagina([evento('a')]))
    await renderizar(<Agenda />)

    expect(await screen.findByText('Não foi possível carregar a agenda')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Lorde Vôlei × Atlética Medicina')).toBeOnTheScreen()
  })

  it('offline com cache: dados e faixa "Modo offline" (critério 19)', async () => {
    listarEventos.mockResolvedValue(pagina([evento('a')]))
    await renderizar(<Agenda />)
    await screen.findByText('Lorde Vôlei × Atlética Medicina')

    await act(() => onlineManager.setOnline(false))

    expect(
      screen.getByText(/^Modo offline · dados de \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/),
    ).toBeOnTheScreen()
    expect(screen.getByText('Lorde Vôlei × Atlética Medicina')).toBeOnTheScreen()
  })

  it('offline sem cache: "Sem conexão" e "Tentar novamente" (critério 19)', async () => {
    onlineManager.setOnline(false)
    await renderizar(<Agenda />)
    expect(
      await screen.findByText('Sem conexão. Conecte-se à internet para carregar os dados.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen()
  })

  it('modalidades fora do ar: só "Todas", e a lista carrega mesmo assim', async () => {
    buscarModalidades.mockRejectedValue(
      new ApiErro({ status: 500, code: 'INTERNAL_ERROR', message: 'x' }),
    )
    listarEventos.mockResolvedValue(pagina([evento('a')]))
    await renderizar(<Agenda />)

    expect(await screen.findByText('Lorde Vôlei × Atlética Medicina')).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Todas' })).toBeSelected()
    expect(screen.queryByRole('radio', { name: 'Vôlei' })).toBeNull()
  })

  it('segmentos: "Jogos e treinos" selecionado; "Placar" troca o parâmetro', async () => {
    listarEventos.mockResolvedValue(pagina([]))
    await renderizar(<Agenda />)

    expect(screen.getByRole('tab', { name: 'Jogos e treinos' })).toBeSelected()
    await fireEvent.press(screen.getByRole('tab', { name: 'Placar' }))
    expect(aoMudarAba).toHaveBeenCalledWith('placar')
  })

  it('segmento Placar não consulta eventos até a #23', async () => {
    await renderizar(<Agenda aba="placar" />)
    expect(screen.getByRole('tab', { name: 'Placar' })).toBeSelected()
    expect(screen.queryByRole('radio', { name: 'Jogos' })).toBeNull()
    expect(listarEventos).not.toHaveBeenCalled()
  })
})
