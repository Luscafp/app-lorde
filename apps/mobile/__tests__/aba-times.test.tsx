import type { ElencoDto, MembroElencoDto, Modalidade, TimeDto } from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'
import type { RefreshControlProps } from 'react-native'
import * as apiModalidades from '@/features/modalidades/api'
import { ListaModalidadesTimes, TelaTime, useTimesProprios } from '@/features/times'
import * as apiTimes from '@/features/times/api'
import { ApiErro } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/features/modalidades/api')
jest.mock('@/features/times/api')

const api = jest.mocked(apiTimes)
const buscarModalidades = jest.mocked(apiModalidades.buscarModalidades)

const modalidade = (id: string, nome: string, icone = 'soccer'): Modalidade => ({
  id,
  nome,
  icone,
  ativa: true,
})
const FUTSAL = modalidade('m-futsal', 'Futsal')
const VOLEI = modalidade('m-volei', 'Vôlei', 'volleyball')

const time = (id: string, nome: string, parcial: Partial<TimeDto> = {}): TimeDto => ({
  id,
  nome,
  ativo: true,
  modalidade: { id: FUTSAL.id, nome: FUTSAL.nome, icone: FUTSAL.icone },
  atletica: { id: 'a1', nome: 'Lorde', sigla: 'LRD', propria: true },
  capitao: null,
  totalMembros: 0,
  ...parcial,
})
const MASCULINO = time('t-masc', 'Futsal Masculino', {
  capitao: { id: 'u-ana', nome: 'Ana Souza' },
  totalMembros: 3,
})
const FEMININO = time('t-fem', 'Futsal Feminino', { totalMembros: 1 })

const membro = (usuarioId: string, nome: string, capitao = false): MembroElencoDto => ({
  usuarioId,
  nome,
  fotoUrl: null,
  entradaEm: '2026-09-01T12:00:00.000Z',
  capitao,
})
const elenco = (items: MembroElencoDto[]): ElencoDto => ({ items, total: items.length })

const pagina = (items: TimeDto[], page = 1, total = items.length) => ({
  items,
  page,
  limit: 20,
  total,
})

const ERRO_500 = new ApiErro({ status: 500, code: 'INTERNAL_ERROR', message: 'x' })
const ERRO_404 = new ApiErro({ status: 404, code: 'NOT_FOUND', message: 'x' })

let cliente: QueryClient

function Provedor({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

const renderizar = (elemento: ReactNode) => render(<Provedor>{elemento}</Provedor>)

function puxarParaAtualizar(testID: string) {
  const { refreshControl } = screen.getByTestId(testID).props as {
    refreshControl: ReactElement<RefreshControlProps>
  }
  return act(() => refreshControl.props.onRefresh?.())
}

beforeEach(() => {
  jest.clearAllMocks()
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  onlineManager.setOnline(true)
  useSessao.setState({
    status: 'autenticado',
    usuario: {
      id: 'u-eu',
      nome: 'Carla Dias',
      email: 'c@x.com',
      fotoUrl: null,
      papel: 'ATLETA',
      atleticaId: 'a1',
    },
  })
  buscarModalidades.mockResolvedValue([VOLEI, FUTSAL])
  api.listarTimes.mockResolvedValue(pagina([MASCULINO, FEMININO]))
})

afterEach(() => cliente.clear())

describe('useTimesProprios', () => {
  it('busca só times próprios e todas as páginas antes de devolver', async () => {
    const primeira = Array.from({ length: 20 }, (_, i) => time(`t${i}`, `Time ${i}`))
    const segunda = Array.from({ length: 3 }, (_, i) => time(`t${20 + i}`, `Time ${20 + i}`))
    api.listarTimes
      .mockResolvedValueOnce(pagina(primeira, 1, 23))
      .mockResolvedValueOnce(pagina(segunda, 2, 23))

    const { result } = await renderHook(() => useTimesProprios(), { wrapper: Provedor })

    await waitFor(() => expect(result.current.data).toHaveLength(23))
    expect(api.listarTimes).toHaveBeenCalledTimes(2)
    expect(api.listarTimes).toHaveBeenNthCalledWith(2, { escopo: 'PROPRIOS' }, 2, expect.anything())
  })

  it('guarda as páginas no mesmo formato da lista paginada do Painel', async () => {
    const { result } = await renderHook(() => useTimesProprios(), { wrapper: Provedor })

    await waitFor(() => expect(result.current.data).toHaveLength(2))
    expect(cliente.getQueryData(chaves.times.lista({ escopo: 'PROPRIOS' }))).toEqual({
      pages: [pagina([MASCULINO, FEMININO])],
      pageParams: [1],
    })
  })
})

describe('ListaModalidadesTimes', () => {
  it('lista as modalidades em ordem alfabética com ícone (critério 1)', async () => {
    await renderizar(<ListaModalidadesTimes aoAbrirTime={jest.fn()} />)

    await screen.findByText('Futsal')
    const textos = screen.getAllByText(/^(Futsal|Vôlei)$/).map((t) => t.props.children as string)
    expect(textos).toEqual(['Futsal', 'Vôlei'])
    expect(screen.getByTestId('icone-volleyball')).toBeOnTheScreen()
  })

  it('a primeira modalidade com times abre expandida, com membros e capitão (critério 2)', async () => {
    await renderizar(<ListaModalidadesTimes aoAbrirTime={jest.fn()} />)

    expect(
      await screen.findByRole('button', { name: 'Futsal, 2 times, recolher' }),
    ).toBeOnTheScreen()
    expect(screen.getByText('Futsal Masculino')).toBeOnTheScreen()
    expect(screen.getByText('3 membros · Capitão: Ana Souza')).toBeOnTheScreen()
    expect(screen.getByText('Futsal Feminino')).toBeOnTheScreen()
    expect(screen.getByText('1 membro · Sem capitão')).toBeOnTheScreen()
  })

  it('modalidade sem times mostra "Nenhum time cadastrado" (critério 3)', async () => {
    await renderizar(<ListaModalidadesTimes aoAbrirTime={jest.fn()} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Vôlei, 0 times, expandir' }))

    expect(screen.getByText('Nenhum time cadastrado')).toBeOnTheScreen()
  })

  it('tocar na modalidade expandida recolhe os times', async () => {
    await renderizar(<ListaModalidadesTimes aoAbrirTime={jest.fn()} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Futsal, 2 times, recolher' }))

    expect(screen.queryByText('Futsal Masculino')).toBeNull()
    expect(screen.getByRole('button', { name: 'Futsal, 2 times, expandir' })).toBeOnTheScreen()
  })

  it('agrupa times de várias modalidades', async () => {
    const VOLEI_MISTO = time('t-volei', 'Vôlei Misto', {
      modalidade: { id: VOLEI.id, nome: VOLEI.nome, icone: VOLEI.icone },
    })
    api.listarTimes.mockResolvedValue(pagina([MASCULINO, VOLEI_MISTO, FEMININO]))
    await renderizar(<ListaModalidadesTimes aoAbrirTime={jest.fn()} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Vôlei, 1 time, expandir' }))

    expect(screen.getByRole('button', { name: 'Futsal, 2 times, recolher' })).toBeOnTheScreen()
    expect(screen.getByText('Vôlei Misto')).toBeOnTheScreen()
  })

  it('tocar no time abre o detalhe (critério 13)', async () => {
    const aoAbrirTime = jest.fn()
    await renderizar(<ListaModalidadesTimes aoAbrirTime={aoAbrirTime} />)

    await fireEvent.press(await screen.findByRole('button', { name: /^Futsal Masculino/ }))

    expect(aoAbrirTime).toHaveBeenCalledWith('t-masc')
  })

  it('erro: "Tentar novamente" refaz a consulta (critério 10)', async () => {
    api.listarTimes.mockRejectedValueOnce(ERRO_500)
    await renderizar(<ListaModalidadesTimes aoAbrirTime={jest.fn()} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByText('Futsal Masculino')).toBeOnTheScreen()
  })

  it('puxar para atualizar refaz modalidades e times', async () => {
    await renderizar(<ListaModalidadesTimes aoAbrirTime={jest.fn()} />)
    await screen.findByText('Futsal Masculino')

    await puxarParaAtualizar('lista-modalidades')

    await waitFor(() => expect(api.listarTimes).toHaveBeenCalledTimes(2))
    expect(buscarModalidades).toHaveBeenCalledTimes(2)
  })

  it('offline com cache: dados e faixa "Modo offline" (critério 11)', async () => {
    await renderizar(<ListaModalidadesTimes aoAbrirTime={jest.fn()} />)
    await screen.findByText('Futsal Masculino')

    await act(() => onlineManager.setOnline(false))

    expect(screen.getByText(/^Modo offline · dados de/)).toBeOnTheScreen()
    expect(screen.getByText('Futsal Masculino')).toBeOnTheScreen()
  })

  it('offline sem cache: "Sem conexão" (critério 11)', async () => {
    onlineManager.setOnline(false)
    await renderizar(<ListaModalidadesTimes aoAbrirTime={jest.fn()} />)

    expect(
      await screen.findByText('Sem conexão. Conecte-se à internet para carregar os dados.'),
    ).toBeOnTheScreen()
  })
})

describe('TelaTime', () => {
  beforeEach(() => {
    api.buscarTime.mockResolvedValue(MASCULINO)
    api.buscarElenco.mockResolvedValue(
      elenco([
        membro('u-bruno', 'Bruno Lima'),
        membro('u-eu', 'Carla Dias'),
        membro('u-ana', 'Ana Souza', true),
        membro('u-andre', 'André Melo'),
      ]),
    )
  })

  it('cabeçalho com modalidade, nome, sigla e nº de atletas', async () => {
    await renderizar(<TelaTime timeId="t-masc" aoVoltar={jest.fn()} />)

    expect(await screen.findByRole('header', { name: 'Futsal Masculino' })).toBeOnTheScreen()
    expect(screen.getByText('Futsal · LRD')).toBeOnTheScreen()
    expect(screen.getByText('3 atletas')).toBeOnTheScreen()
    expect(screen.getByTestId('icone-soccer')).toBeOnTheScreen()
  })

  it('capitão primeiro com chip, demais em ordem alfabética e "(você)" (critério 4)', async () => {
    await renderizar(<TelaTime timeId="t-masc" aoVoltar={jest.fn()} />)

    await screen.findByText('Ana Souza')
    const nomes = screen.getAllByTestId('nome-membro').map((t) => t.props.children as string)
    expect(nomes).toEqual(['Ana Souza', 'André Melo', 'Bruno Lima', 'Carla Dias (você)'])
    expect(screen.getAllByText('CAPITÃO')).toHaveLength(1)
    expect(screen.getByLabelText('Capitão')).toBeOnTheScreen()
  })

  it('elenco vazio mostra "Elenco ainda vazio"', async () => {
    api.buscarElenco.mockResolvedValue(elenco([]))
    await renderizar(<TelaTime timeId="t-masc" aoVoltar={jest.fn()} />)

    expect(await screen.findByText('Elenco ainda vazio')).toBeOnTheScreen()
  })

  it('404 mostra "Time não encontrado" e volta para Times (critério 9)', async () => {
    api.buscarTime.mockRejectedValue(ERRO_404)
    const aoVoltar = jest.fn()
    await renderizar(<TelaTime timeId="t-x" aoVoltar={aoVoltar} />)

    expect(await screen.findByText('Time não encontrado')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar para Times' }))
    expect(aoVoltar).toHaveBeenCalled()
  })

  it('erro no detalhe: "Tentar novamente" refaz a consulta (critério 10)', async () => {
    api.buscarTime.mockRejectedValueOnce(ERRO_500)
    await renderizar(<TelaTime timeId="t-masc" aoVoltar={jest.fn()} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByRole('header', { name: 'Futsal Masculino' })).toBeOnTheScreen()
  })

  it('falha no elenco não esconde o cabeçalho', async () => {
    api.buscarElenco.mockRejectedValueOnce(ERRO_500)
    await renderizar(<TelaTime timeId="t-masc" aoVoltar={jest.fn()} />)

    expect(await screen.findByRole('header', { name: 'Futsal Masculino' })).toBeOnTheScreen()
    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen()
  })

  it('puxar para atualizar refaz time e elenco', async () => {
    await renderizar(<TelaTime timeId="t-masc" aoVoltar={jest.fn()} />)
    await screen.findByText('Ana Souza')

    await puxarParaAtualizar('detalhe-time')

    await waitFor(() => expect(api.buscarElenco).toHaveBeenCalledTimes(2))
    expect(api.buscarTime).toHaveBeenCalledTimes(2)
  })

  it('offline sem cache: "Sem conexão" (critério 11)', async () => {
    onlineManager.setOnline(false)
    await renderizar(<TelaTime timeId="t-masc" aoVoltar={jest.fn()} />)

    expect(
      await screen.findByText('Sem conexão. Conecte-se à internet para carregar os dados.'),
    ).toBeOnTheScreen()
  })

  it('offline com cache mostra uma única faixa', async () => {
    await renderizar(<TelaTime timeId="t-masc" aoVoltar={jest.fn()} />)
    await screen.findByText('Ana Souza')

    await act(() => onlineManager.setOnline(false))

    expect(screen.getAllByText(/^Modo offline · dados de/)).toHaveLength(1)
  })
})
