import type { EventoDetalheDto, EventoResumoDto, ListaEventos, Papel } from '@atletica/shared'
import NetInfo from '@react-native-community/netinfo'
import { QueryClientProvider, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'
import type { RefreshControlProps } from 'react-native'
import { TelaEvento } from '@/features/eventos'
import { ApiErro } from '@/infra/api/api-erro'
import { api } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'
import { configurarRede } from '@/infra/rede/online'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/infra/api/cliente', () => ({
  ...jest.requireActual<object>('@/infra/api/cliente'),
  api: { get: jest.fn() },
}))

const get = jest.mocked(api.get)
const buscasDoEvento = () => get.mock.calls.filter(([caminho]) => caminho === `/eventos/${ID}`)
const netInfo = NetInfo as unknown as { __emitir: (estado: object) => void }
const emitirRede = (online: boolean) =>
  act(() => netInfo.__emitir({ isConnected: online, isInternetReachable: online }))

const ID = '3c9a1f0e-2b7a-4d4e-9a65-1c2b3c4d5e6f'
const ERRO_500 = new ApiErro({ status: 500, code: 'INTERNAL_ERROR', message: 'x' })
const ERRO_404 = new ApiErro({ status: 404, code: 'NOT_FOUND', message: 'x' })

const resumo = (parcial: Partial<EventoResumoDto> = {}): EventoResumoDto => ({
  id: ID,
  tipo: 'JOGO',
  status: 'AGENDADO',
  inicio: '2026-10-10T22:00:00.000Z',
  local: 'Ginásio Castelinho',
  serieId: null,
  time: { id: '0b6f1f0e-2b7a-4d4e-9a65-1c2b3c4d5e60', nome: 'Lorde Vôlei Masculino' },
  modalidade: { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', nome: 'Vôlei', icone: 'volleyball' },
  timeAdversario: {
    id: '7d1e2f3a-4b5c-4d6e-8f90-a1b2c3d4e5f6',
    nome: 'Vôlei Masculino',
    atletica: {
      id: 'e4d3c2b1-a5b4-4c3d-9e2f-1a0b9c8d7e6f',
      nome: 'Atlética Medicina',
      sigla: 'AAMED',
    },
  },
  placarTime: null,
  placarAdversario: null,
  resultado: null,
  souMembro: true,
  minhaParticipacao: null,
  ...parcial,
})

const detalhe = (parcial: Partial<EventoDetalheDto> = {}): EventoDetalheDto => ({
  ...resumo(),
  observacoes: 'Chegar 30 min antes',
  criadoEm: '2026-10-01T12:00:00.000Z',
  atualizadoEm: '2026-10-01T12:00:00.000Z',
  serie: null,
  contagem: { confirmados: 8, recusados: 2, semResposta: 4, elenco: 14 },
  confirmados: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      nome: 'Bruno Lima',
      fotoUrl: null,
      capitao: false,
    },
    { id: '22222222-2222-4222-8222-222222222222', nome: 'Ana Souza', fotoUrl: null, capitao: true },
  ],
  podeResponder: true,
  motivoBloqueioResposta: null,
  ...parcial,
})

let cliente: QueryClient

function Provedor({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

function renderizar(aoGerenciar = jest.fn()) {
  return render(<TelaEvento id={ID} aoGerenciar={aoGerenciar} />, { wrapper: Provedor })
}

function comPapel(papel: Papel) {
  useSessao.setState({
    status: 'autenticado',
    usuario: { id: 'u-eu', nome: 'Eu', email: 'e@x.com', fotoUrl: null, papel, atleticaId: 'a1' },
  })
}

function cardNaAgenda() {
  const lista: InfiniteData<ListaEventos> = {
    pages: [{ items: [resumo()], page: 1, limit: 20, total: 1 }],
    pageParams: [1],
  }
  cliente.setQueryData(chaves.eventos.lista({ periodo: 'PROXIMOS' }), lista)
}

beforeAll(() => configurarRede())

beforeEach(async () => {
  jest.clearAllMocks()
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  await emitirRede(true)
  comPapel('ATLETA')
})

afterEach(() => cliente.clear())

describe('Detalhe do evento', () => {
  it('chips, título, informações e contagem (critério 11)', async () => {
    get.mockResolvedValue(detalhe({ serieId: ID }))
    await renderizar()
    expect(get).toHaveBeenCalledWith(`/eventos/${ID}`, expect.anything())

    expect(
      await screen.findByRole('header', { name: 'Lorde Vôlei Masculino × Atlética Medicina' }),
    ).toBeOnTheScreen()
    expect(screen.getByText('JOGO')).toBeOnTheScreen()
    expect(screen.getAllByText('Vôlei')).toHaveLength(2)
    expect(screen.getByText('Agendado')).toBeOnTheScreen()
    expect(screen.getByText('↺ Recorrente')).toBeOnTheScreen()
    expect(screen.getByText('10/10/2026 19:00')).toBeOnTheScreen()
    expect(screen.getByText('Ginásio Castelinho')).toBeOnTheScreen()
    expect(screen.getByText('Chegar 30 min antes')).toBeOnTheScreen()
    expect(screen.getByTestId('contagem')).toHaveTextContent('8 vão · 2 não vão · 4 sem resposta')
  })

  it('slot ParticipacaoAcoes renderizado vazio', async () => {
    get.mockResolvedValue(detalhe())
    await renderizar()
    expect(await screen.findByTestId('slot-participacao')).toBeEmptyElement()
  })

  it('"Quem vai" com capitão primeiro e selo', async () => {
    get.mockResolvedValue(detalhe())
    await renderizar()
    await screen.findByText('Quem vai')
    expect(
      screen.getAllByTestId('nome-confirmado').map((nome) => nome.props.children as string),
    ).toEqual(['Ana Souza', 'Bruno Lima'])
    expect(screen.getByLabelText('Capitão')).toBeOnTheScreen()
  })

  it('"Quem vai" vazio e contagem no singular', async () => {
    get.mockResolvedValue(
      detalhe({
        contagem: { confirmados: 0, recusados: 1, semResposta: 1, elenco: 2 },
        confirmados: [],
      }),
    )
    await renderizar()
    expect(await screen.findByText('Ninguém confirmou ainda')).toBeOnTheScreen()
    expect(screen.getByTestId('contagem')).toHaveTextContent('0 vão · 1 não vai · 1 sem resposta')
  })

  it('cancelado: chip "Cancelado" e título riscado (critério 13)', async () => {
    get.mockResolvedValue(
      detalhe({
        status: 'CANCELADO',
        podeResponder: false,
        motivoBloqueioResposta: 'EVENTO_CANCELADO',
      }),
    )
    await renderizar()

    expect(await screen.findByText('Cancelado')).toBeOnTheScreen()
    expect(screen.getByTestId('titulo-evento').props.className).toMatch(/line-through/)
    expect(screen.queryByTestId('slot-participacao')).toBeNull()
  })

  it('não cancelado: título sem risco', async () => {
    get.mockResolvedValue(detalhe())
    await renderizar()
    expect((await screen.findByTestId('titulo-evento')).props.className).not.toMatch(/line-through/)
  })
})

describe('Cartão do placar', () => {
  it('com resultado: placar e chip do resultado', async () => {
    get.mockResolvedValue(
      detalhe({ status: 'FINALIZADO', placarTime: 3, placarAdversario: 1, resultado: 'VITORIA' }),
    )
    await renderizar()
    expect(await screen.findByText('3 × 1')).toBeOnTheScreen()
    expect(screen.getByText('Vitória')).toBeOnTheScreen()
    expect(screen.queryByText('Resultado pendente')).toBeNull()
  })

  it('jogo FINALIZADO sem placar: "Resultado pendente"', async () => {
    get.mockResolvedValue(detalhe({ status: 'FINALIZADO' }))
    await renderizar()
    expect(await screen.findByText('Resultado pendente')).toBeOnTheScreen()
    expect(screen.getByText('VS')).toBeOnTheScreen()
  })

  it('jogo agendado: VS sem resultado', async () => {
    get.mockResolvedValue(detalhe())
    await renderizar()
    expect(await screen.findByText('VS')).toBeOnTheScreen()
    expect(screen.getByText('AAMED')).toBeOnTheScreen()
    expect(screen.queryByText('Resultado pendente')).toBeNull()
  })

  it('treino: sem cartão e título "Treino — <time>"', async () => {
    get.mockResolvedValue(detalhe({ tipo: 'TREINO', timeAdversario: null }))
    await renderizar()
    expect(
      await screen.findByRole('header', { name: 'Treino — Lorde Vôlei Masculino' }),
    ).toBeOnTheScreen()
    expect(screen.getByText('TREINO')).toBeOnTheScreen()
    expect(screen.queryByTestId('cartao-placar')).toBeNull()
  })
})

describe('Gerenciar', () => {
  it('Atleta (nível 1): não aparece', async () => {
    get.mockResolvedValue(detalhe())
    await renderizar()
    await screen.findByTestId('contagem')
    expect(screen.queryByRole('button', { name: 'Gerenciar' })).toBeNull()
  })

  it.each(['DIRETOR', 'PRESIDENTE', 'VICE_PRESIDENTE', 'ADMINISTRADOR'] as const)(
    '%s: aparece e abre o detalhe do Painel (critério 21)',
    async (papel) => {
      comPapel(papel)
      get.mockResolvedValue(detalhe())
      const aoGerenciar = jest.fn()
      await renderizar(aoGerenciar)

      await fireEvent.press(await screen.findByRole('button', { name: 'Gerenciar' }))
      expect(aoGerenciar).toHaveBeenCalled()
    },
  )
})

describe('Estados', () => {
  it('carregando: esqueleto', async () => {
    get.mockReturnValue(new Promise(() => undefined))
    await renderizar()
    expect(screen.getByLabelText('Carregando')).toBeOnTheScreen()
  })

  it('erro: "Tentar novamente" refaz a consulta', async () => {
    get.mockRejectedValueOnce(ERRO_500).mockResolvedValue(detalhe())
    await renderizar()

    expect(await screen.findByText('Não foi possível carregar.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByTestId('contagem')).toBeOnTheScreen()
  })

  it('404: "Evento não encontrado", mesmo com cache (critério 15)', async () => {
    cliente.setQueryData(chaves.eventos.detalhe(ID), detalhe())
    get.mockRejectedValue(ERRO_404)
    await renderizar()

    expect(await screen.findByText('Evento não encontrado')).toBeOnTheScreen()
    expect(screen.queryByTestId('detalhe-evento')).toBeNull()
  })

  it('offline com cache: dados e faixa "Modo offline"', async () => {
    get.mockResolvedValue(detalhe())
    await renderizar()
    await screen.findByTestId('contagem')

    await emitirRede(false)

    expect(screen.getByText(/^Modo offline · dados de/)).toBeOnTheScreen()
    expect(screen.getByTestId('contagem')).toBeOnTheScreen()
  })

  it('offline sem cache: "Sem conexão" + "Tentar novamente"', async () => {
    await emitirRede(false)
    await renderizar()
    expect(
      await screen.findByText('Sem conexão. Conecte-se à internet para carregar os dados.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen()
  })

  it('placeholder do card da lista enquanto o detalhe carrega (RNF03)', async () => {
    cardNaAgenda()
    get.mockReturnValue(new Promise(() => undefined))
    await renderizar()

    expect(
      screen.getByRole('header', { name: 'Lorde Vôlei Masculino × Atlética Medicina' }),
    ).toBeOnTheScreen()
    expect(screen.getByText('Ginásio Castelinho')).toBeOnTheScreen()
    expect(screen.queryByTestId('contagem')).toBeNull()
  })

  it('offline só com o card: seção Participação em "Sem conexão" e faixa com a data da lista', async () => {
    cardNaAgenda()
    await emitirRede(false)
    await renderizar()

    expect(
      screen.getByRole('header', { name: 'Lorde Vôlei Masculino × Atlética Medicina' }),
    ).toBeOnTheScreen()
    expect(screen.getByText(/^Modo offline · dados de/)).toBeOnTheScreen()
    expect(
      screen.getByText('Sem conexão. Conecte-se à internet para carregar os dados.'),
    ).toBeOnTheScreen()
    expect(screen.queryByTestId('contagem')).toBeNull()
  })

  it('erro com o card na tela: "Tentar novamente" refaz a consulta', async () => {
    cardNaAgenda()
    get.mockRejectedValueOnce(ERRO_500).mockResolvedValue(detalhe())
    await renderizar()

    expect(await screen.findByText('Não foi possível carregar.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByTestId('contagem')).toBeOnTheScreen()
  })

  it('pull-to-refresh refaz a consulta', async () => {
    get.mockResolvedValue(detalhe())
    await renderizar()
    await screen.findByTestId('contagem')

    const { refreshControl } = screen.getByTestId('detalhe-evento').props as {
      refreshControl: ReactElement<RefreshControlProps>
    }
    await act(() => refreshControl.props.onRefresh?.())

    expect(buscasDoEvento()).toHaveLength(2)
  })
})
