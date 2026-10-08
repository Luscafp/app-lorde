import type { EventoResumoDto, ListaEventos } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { router } from 'expo-router'
import EventosPainel from '../app/(app)/(abas)/painel/eventos/index'
import * as apiEventos from '@/features/eventos/api'
import { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'

jest.mock('@/features/eventos/api', () => ({ LIMITE_PAGINA: 20, listarEventos: jest.fn() }))
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

const listarEventos = jest.mocked(apiEventos.listarEventos)

const evento = (id: string, parcial: Partial<EventoResumoDto> = {}): EventoResumoDto => ({
  id,
  tipo: 'JOGO',
  status: 'AGENDADO',
  inicio: '2030-10-09T22:00:00.000Z',
  local: 'Ginásio Castelinho',
  serieId: null,
  time: { id: 't1', nome: 'Lorde Vôlei' },
  modalidade: { id: 'm1', nome: 'Vôlei', icone: 'volleyball' },
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

const JOGO = 'Lorde Vôlei × Atlética Medicina'
const TREINO = 'Treino — Lorde Vôlei'

let cliente: QueryClient

function Provedor({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

const renderizar = () => render(<EventosPainel />, { wrapper: Provedor })

const consultasFeitas = () =>
  listarEventos.mock.calls.map(([filtros, { page }]) => ({ filtros, page }))
/** A `FlatList` só monta as primeiras linhas; os dados mostram a lista inteira. */
const idsNaLista = () =>
  (screen.getByTestId('lista-eventos-painel').props.data as { evento?: { id: string } }[]).flatMap(
    ({ evento }) => (evento ? [evento.id] : []),
  )
const cabecalhos = () =>
  screen.getAllByRole('header').map((cabecalho) => cabecalho.props.children as string)

beforeEach(() => {
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  onlineManager.setOnline(true)
  jest.clearAllMocks()
  listarEventos.mockReset()
})

afterEach(() => {
  cliente.clear()
  jest.restoreAllMocks()
})

describe('Painel: lista de eventos', () => {
  it('abre em "Próximos" com inativos, agrupada por dia na ordem da API', async () => {
    listarEventos.mockResolvedValue(
      pagina([evento('a'), treino('b', { inicio: '2030-10-11T12:00:00.000Z' })]),
    )
    await renderizar()

    expect(await screen.findByText(JOGO)).toBeOnTheScreen()
    expect(cabecalhos()).toEqual(['qua, 09/10', 'sex, 11/10'])
    expect(screen.getByRole('tab', { name: 'Próximos' })).toBeSelected()
    expect(consultasFeitas()).toEqual([
      { filtros: { periodo: 'PROXIMOS', incluirInativos: true }, page: 1 },
    ])
  })

  it('dias de hoje e amanhã (no fuso de Fortaleza) viram "Hoje" e "Amanhã"', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2030-10-09T15:00:00.000Z'))
    listarEventos.mockResolvedValue(
      pagina([
        evento('a', { inicio: '2030-10-09T22:00:00.000Z' }),
        treino('b', { inicio: '2030-10-11T02:30:00.000Z' }),
        treino('c', { inicio: '2030-10-11T12:00:00.000Z' }),
      ]),
    )
    await renderizar()
    await screen.findByText(JOGO)

    expect(cabecalhos()).toEqual(['Hoje', 'Amanhã', 'sex, 11/10'])
  })

  it('puxar para atualizar refaz a consulta da 1ª página', async () => {
    listarEventos.mockResolvedValue(pagina([evento('a')]))
    await renderizar()
    await screen.findByText(JOGO)

    await act(() => fireEvent(screen.getByTestId('lista-eventos-painel'), 'refresh'))

    await waitFor(() => expect(consultasFeitas().map(({ page }) => page)).toEqual([1, 1]))
  })

  it('"Passados" consulta o período e mostra os dias em ordem decrescente', async () => {
    listarEventos.mockImplementation((filtros) =>
      Promise.resolve(
        pagina(
          filtros.periodo === 'PASSADOS'
            ? [
                treino('c', { inicio: '2026-09-20T12:00:00.000Z' }),
                evento('d', { inicio: '2026-09-15T22:00:00.000Z', status: 'FINALIZADO' }),
              ]
            : [evento('a')],
        ),
      ),
    )
    await renderizar()
    await screen.findByText(JOGO)

    await fireEvent.press(screen.getByRole('tab', { name: 'Passados' }))

    expect(await screen.findByText('FINALIZADO')).toBeOnTheScreen()
    expect(cabecalhos()).toEqual(['dom, 20/09', 'ter, 15/09'])
    expect(consultasFeitas().at(-1)).toEqual({
      filtros: { periodo: 'PASSADOS', incluirInativos: true },
      page: 1,
    })
  })

  it('evento às 23:30 em Fortaleza (02:30Z do dia seguinte) fica no dia local', async () => {
    listarEventos.mockResolvedValue(
      pagina([
        evento('a', { inicio: '2030-10-09T12:00:00.000Z' }),
        treino('b', { inicio: '2030-10-10T02:30:00.000Z' }),
      ]),
    )
    await renderizar()
    await screen.findByText(JOGO)

    expect(cabecalhos()).toEqual(['qua, 09/10'])
  })

  it('tipo e status vão para a consulta, mantendo período e inativos', async () => {
    listarEventos.mockResolvedValue(pagina([evento('a')]))
    await renderizar()
    await screen.findByText(JOGO)

    await fireEvent.press(screen.getByRole('tab', { name: 'Todos' }))
    await fireEvent.press(screen.getByRole('radio', { name: 'Treinos' }))
    await fireEvent.press(screen.getByRole('radio', { name: 'Cancelados' }))

    await waitFor(() =>
      expect(consultasFeitas().at(-1)).toEqual({
        filtros: { periodo: 'TODOS', tipo: 'TREINO', status: 'CANCELADO', incluirInativos: true },
        page: 1,
      }),
    )
  })

  it('filtros sem resultado: "Limpar filtros" mantém o período', async () => {
    listarEventos.mockImplementation((filtros) =>
      Promise.resolve(pagina(filtros.status ? [] : [evento('a')])),
    )
    await renderizar()
    await screen.findByText(JOGO)
    await fireEvent.press(screen.getByRole('tab', { name: 'Passados' }))
    await fireEvent.press(screen.getByRole('radio', { name: 'Cancelados' }))

    expect(await screen.findByText('Nenhum evento para os filtros escolhidos')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Limpar filtros' }))

    expect(await screen.findByText(JOGO)).toBeOnTheScreen()
    expect(consultasFeitas().at(-1)?.filtros).toEqual({
      periodo: 'PASSADOS',
      incluirInativos: true,
    })
    expect(screen.getByRole('radio', { name: 'Todos os status' })).toBeSelected()
  })

  it('selo "RECORRENTE" só em evento de série; cancelado mostra o chip', async () => {
    listarEventos.mockResolvedValue(
      pagina([
        treino('a', { serieId: '0b9c6a1e-6f2d-4c3b-9a8e-7d6c5b4a3f21' }),
        evento('b', { status: 'CANCELADO' }),
      ]),
    )
    await renderizar()

    const cardTreino = await screen.findByRole('button', { name: /^Treino — Lorde Vôlei/ })
    expect(within(cardTreino).getByText('RECORRENTE')).toBeOnTheScreen()
    const cardJogo = screen.getByRole('button', { name: /^Lorde Vôlei × Atlética Medicina/ })
    expect(within(cardJogo).getByText('CANCELADO')).toBeOnTheScreen()
    expect(within(cardJogo).queryByText('RECORRENTE')).toBeNull()
  })

  it('chip "Resultado pendente" consulta os jogos finalizados sem placar (critério 21)', async () => {
    listarEventos.mockResolvedValue(pagina([evento('a')]))
    await renderizar()
    await screen.findByText(JOGO)
    await fireEvent.press(screen.getByRole('radio', { name: 'Treinos' }))

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Resultado pendente' }))

    await waitFor(() =>
      expect(consultasFeitas().at(-1)).toEqual({
        filtros: {
          tipo: 'JOGO',
          status: 'FINALIZADO',
          resultado: 'PENDENTE',
          periodo: 'TODOS',
          incluirInativos: true,
        },
        page: 1,
      }),
    )
    expect(screen.getByRole('checkbox', { name: 'Resultado pendente' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: 'Treinos' })).toBeNull()

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Resultado pendente' }))
    expect(screen.getByRole('radio', { name: 'Treinos' })).toBeSelected()
  })

  it('selo "RESULTADO PENDENTE" só no jogo finalizado sem resultado', async () => {
    listarEventos.mockResolvedValue(
      pagina([
        evento('a', { status: 'FINALIZADO' }),
        evento('b', {
          status: 'FINALIZADO',
          time: { id: 't3', nome: 'Lorde Futsal' },
          placarTime: 2,
          placarAdversario: 1,
          resultado: 'VITORIA',
        }),
        treino('c', { status: 'FINALIZADO' }),
      ]),
    )
    await renderizar()

    const pendente = await screen.findByRole('button', { name: /^Lorde Vôlei × Atlética Medicina/ })
    expect(within(pendente).getByText('RESULTADO PENDENTE')).toBeOnTheScreen()
    const registrado = screen.getByRole('button', { name: /^Lorde Futsal × Atlética Medicina/ })
    expect(within(registrado).queryByText('RESULTADO PENDENTE')).toBeNull()
    const cardTreino = screen.getByRole('button', { name: /^Treino — Lorde Vôlei/ })
    expect(within(cardTreino).queryByText('RESULTADO PENDENTE')).toBeNull()
  })

  it('23 eventos: o fim da lista carrega a 2ª página sem duplicar itens', async () => {
    const todos = Array.from({ length: 23 }, (_, i) => evento(`e${i}`))
    listarEventos
      .mockResolvedValueOnce(pagina(todos.slice(0, 20), 1, 23))
      .mockResolvedValueOnce(pagina(todos.slice(19), 2, 23))
    await renderizar()
    await screen.findAllByText(JOGO)

    await fireEvent(screen.getByTestId('lista-eventos-painel'), 'endReached')

    await waitFor(() => expect(idsNaLista()).toHaveLength(23))
    expect(new Set(idsNaLista()).size).toBe(23)
    expect(consultasFeitas().map(({ page }) => page)).toEqual([1, 2])

    await fireEvent(screen.getByTestId('lista-eventos-painel'), 'endReached')
    expect(consultasFeitas()).toHaveLength(2)
  })

  it('sem eventos: "Nenhum evento cadastrado" e "Novo evento"', async () => {
    listarEventos.mockResolvedValue(pagina([]))
    await renderizar()

    expect(await screen.findByText('Nenhum evento cadastrado')).toBeOnTheScreen()
    const botoes = screen.getAllByRole('button', { name: 'Novo evento' })
    expect(botoes).toHaveLength(2)
    await fireEvent.press(botoes[0]!)
    expect(router.push).toHaveBeenCalledWith('/painel/eventos/novo')
  })

  it('FAB abre o formulário e o card abre o detalhe do Painel', async () => {
    listarEventos.mockResolvedValue(pagina([evento('a')]))
    await renderizar()

    await fireEvent.press(await screen.findByRole('button', { name: /^Lorde Vôlei × Atlética/ }))
    expect(router.push).toHaveBeenLastCalledWith('/painel/eventos/a')

    await fireEvent.press(screen.getByRole('button', { name: 'Novo evento' }))
    expect(router.push).toHaveBeenLastCalledWith('/painel/eventos/novo')
  })

  it('carregando: esqueleto de cards', async () => {
    listarEventos.mockReturnValue(new Promise(() => {}))
    await renderizar()
    expect(screen.getByLabelText('Carregando')).toBeOnTheScreen()
    expect(screen.getByTestId('esqueleto-cartoes')).toBeOnTheScreen()
  })

  it('erro: mensagem e "Tentar novamente"', async () => {
    listarEventos
      .mockRejectedValueOnce(new ApiErro({ status: 500, code: 'INTERNAL_ERROR', message: 'x' }))
      .mockResolvedValue(pagina([evento('a')]))
    await renderizar()

    expect(await screen.findByText('Não foi possível carregar os eventos')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText(JOGO)).toBeOnTheScreen()
  })

  it('offline com cache: lista e faixa "Modo offline"', async () => {
    listarEventos.mockResolvedValue(pagina([evento('a')]))
    await renderizar()
    await screen.findByText(JOGO)

    await act(() => onlineManager.setOnline(false))

    expect(
      screen.getByText(/^Modo offline · dados de \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/),
    ).toBeOnTheScreen()
    expect(screen.getByText(JOGO)).toBeOnTheScreen()
  })

  it('offline sem cache: "Sem conexão" e "Tentar novamente"', async () => {
    onlineManager.setOnline(false)
    await renderizar()
    expect(
      await screen.findByText('Sem conexão. Conecte-se à internet para carregar os dados.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen()
  })

  it('invalidar o prefixo ["eventos"] (criar/cancelar na #71) atualiza a lista', async () => {
    listarEventos
      .mockResolvedValueOnce(pagina([evento('a')]))
      .mockResolvedValue(pagina([evento('a', { status: 'CANCELADO' }), treino('b')]))
    await renderizar()
    await screen.findByText(JOGO)

    await act(() => cliente.invalidateQueries({ queryKey: chaves.eventos.todos() }))

    expect(await screen.findByText(TREINO)).toBeOnTheScreen()
    expect(screen.getByText('CANCELADO')).toBeOnTheScreen()
  })
})
