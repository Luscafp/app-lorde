import type {
  EventoResumoDto,
  ListaEventos,
  ListaNoticias,
  NoticiaResumoDto,
} from '@atletica/shared'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'
import type { RefreshControlProps } from 'react-native'
import { listarBanners } from '@/features/banners/api'
import { listarEventos } from '@/features/eventos/api'
import { TelaHome } from '@/features/home'
import { listarNoticias } from '@/features/noticias/api'
import { ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient } from '@/infra/query/query-client'
import { useMarcarHomePronta } from '@/infra/sentry'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/features/eventos/api', () => ({ LIMITE_PAGINA: 20, listarEventos: jest.fn() }))
jest.mock('@/features/noticias/api', () => ({ LIMITE_PAGINA: 20, listarNoticias: jest.fn() }))
jest.mock('@/features/banners/api', () => ({ listarBanners: jest.fn() }))

jest.mock('@/infra/sentry', () => ({
  ...jest.requireActual<object>('@/infra/sentry'),
  useMarcarHomePronta: jest.fn(),
}))

const eventosApi = jest.mocked(listarEventos)
const noticiasApi = jest.mocked(listarNoticias)
const bannersApi = jest.mocked(listarBanners)

const evento = (id: string, parcial: Partial<EventoResumoDto> = {}): EventoResumoDto => ({
  id,
  tipo: 'TREINO',
  status: 'AGENDADO',
  inicio: '2030-10-09T22:00:00.000Z',
  local: 'Ginásio',
  serieId: null,
  time: { id: 't1', nome: `Time ${id}` },
  modalidade: { id: 'm1', nome: 'Futsal', icone: 'soccer' },
  timeAdversario: null,
  placarTime: null,
  placarAdversario: null,
  resultado: null,
  souMembro: false,
  minhaParticipacao: null,
  ...parcial,
})

const noticia = (id: string): NoticiaResumoDto => ({
  id,
  titulo: `Notícia ${id}`,
  imagemCapaUrl: 'https://img.exemplo.com/capa.jpg',
  publicadaEm: '2026-09-28T18:00:00.000Z',
  resumo: 'Resumo.',
})

const listaEventos = (items: EventoResumoDto[]): ListaEventos => ({
  items,
  page: 1,
  limit: 5,
  total: items.length,
})

const listaNoticias = (items: NoticiaResumoDto[]): ListaNoticias => ({
  items,
  page: 1,
  limit: 3,
  total: items.length,
})

const falha = () => new ApiErro({ status: 500, code: 'INTERNAL_ERROR', message: 'x' })

let cliente: QueryClient

function Provedor({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

const renderizar = (elemento: ReactElement) => render(elemento, { wrapper: Provedor })

const navegacao = {
  aoAbrirAgenda: jest.fn(),
  aoAbrirTimes: jest.fn(),
  aoAbrirNoticias: jest.fn(),
  aoAbrirEvento: jest.fn(),
  aoAbrirNoticia: jest.fn(),
  aoAbrirPerfil: jest.fn(),
}

const abrirHome = () => renderizar(<TelaHome {...navegacao} />)

const refreshControl = () =>
  (screen.getByTestId('home').props as { refreshControl: ReactElement<RefreshControlProps> })
    .refreshControl

beforeEach(() => {
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  onlineManager.setOnline(true)
  jest.clearAllMocks()
  eventosApi.mockReset().mockResolvedValue(listaEventos([evento('a')]))
  noticiasApi.mockReset().mockResolvedValue(listaNoticias([noticia('n1')]))
  bannersApi.mockReset().mockResolvedValue([])
  useSessao.setState({
    usuario: {
      id: 'u1',
      nome: 'Ana Souza',
      email: 'a@x.com',
      fotoUrl: null,
      papel: 'ATLETA',
      atleticaId: 'a1',
    },
  })
})

afterEach(() => {
  cliente.clear()
})

describe('Home', () => {
  it('ordem: cabeçalho, atalhos, "Próximos eventos" e "Últimas notícias" (critério 1)', async () => {
    await abrirHome()
    await screen.findByText('Notícia n1')

    const marcos = screen
      .getAllByText(/^(Atlética|Placar|Próximos eventos|Últimas notícias)$/)
      .map(({ props }) => props.children as string)
    expect(marcos).toEqual(['Atlética', 'Placar', 'Próximos eventos', 'Últimas notícias'])
    expect(screen.getByRole('header', { name: 'Atlética' })).toBeOnTheScreen()
  })

  it('consulta 5 próximos eventos e 3 notícias com as chaves canônicas, em paralelo', async () => {
    eventosApi.mockReturnValue(new Promise(() => {}))
    noticiasApi.mockReturnValue(new Promise(() => {}))
    await abrirHome()

    expect(eventosApi).toHaveBeenCalledWith(
      { periodo: 'PROXIMOS' },
      { page: 1, limit: 5 },
      expect.anything(),
    )
    expect(noticiasApi).toHaveBeenCalledWith({ page: 1, limit: 3 }, expect.anything())
    expect(
      cliente.getQueryState(chaves.eventos.lista({ periodo: 'PROXIMOS', limit: 5 })),
    ).toBeDefined()
    expect(cliente.getQueryState(chaves.noticias.lista({ limit: 3 }))).toBeDefined()
    expect(screen.getAllByLabelText('Carregando')).toHaveLength(2)
  })

  it('no máximo 5 eventos e o card abre o evento (critérios 2 e 6)', async () => {
    eventosApi.mockResolvedValue(listaEventos([...'abcdefgh'].map((id) => evento(id))))
    await abrirHome()

    expect(await screen.findAllByRole('button', { name: /^Treino — Time / })).toHaveLength(5)
    await fireEvent.press(screen.getByRole('button', { name: /^Treino — Time c/ }))
    expect(navegacao.aoAbrirEvento).toHaveBeenCalledWith('c')
  })

  it('chip de resposta para membro', async () => {
    eventosApi.mockResolvedValue(listaEventos([evento('a', { souMembro: true })]))
    await abrirHome()
    expect(await screen.findByText('RESPONDER')).toBeOnTheScreen()
  })

  it('no máximo 3 notícias, com título e data dd/mm/aaaa (critério 7)', async () => {
    noticiasApi.mockResolvedValue(listaNoticias(['n1', 'n2', 'n3', 'n4'].map(noticia)))
    await abrirHome()

    const cards = await screen.findAllByRole('button', {
      name: /^Notícia n\d, \d{2}\/\d{2}\/\d{4}$/,
    })
    expect(cards).toHaveLength(3)
  })

  it('notícia tocada abre o detalhe', async () => {
    await abrirHome()
    await fireEvent.press(await screen.findByRole('button', { name: /^Notícia n1/ }))
    expect(navegacao.aoAbrirNoticia).toHaveBeenCalledWith('n1')
  })

  it('sem eventos nem notícias: mensagens de vazio (critérios 5 e 12)', async () => {
    eventosApi.mockResolvedValue(listaEventos([]))
    noticiasApi.mockResolvedValue(listaNoticias([]))
    await abrirHome()

    expect(await screen.findByText('Nenhum evento agendado')).toBeOnTheScreen()
    expect(await screen.findByText('Nenhuma notícia publicada')).toBeOnTheScreen()
  })

  it('eventos falham e notícias não: erro só na seção de eventos (critério 13)', async () => {
    eventosApi.mockRejectedValueOnce(falha()).mockResolvedValue(listaEventos([evento('a')]))
    await abrirHome()

    expect(await screen.findByText('Não foi possível carregar os eventos')).toBeOnTheScreen()
    expect(await screen.findByText('Notícia n1')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Treino — Time a')).toBeOnTheScreen()
    expect(eventosApi).toHaveBeenCalledTimes(2)
    expect(noticiasApi).toHaveBeenCalledTimes(1)
  })

  it('"Tentar novamente" numa seção não liga o indicador do pull-to-refresh', async () => {
    eventosApi.mockRejectedValueOnce(falha()).mockReturnValue(new Promise(() => {}))
    await abrirHome()

    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar novamente' }))
    expect(eventosApi).toHaveBeenCalledTimes(2)
    expect(refreshControl().props.refreshing).toBe(false)
  })

  it('notícias falham e eventos não: "Tentar novamente" refaz só as notícias', async () => {
    noticiasApi.mockRejectedValueOnce(falha()).mockResolvedValue(listaNoticias([noticia('n1')]))
    await abrirHome()

    expect(await screen.findByText('Não foi possível carregar as notícias')).toBeOnTheScreen()
    expect(await screen.findByText('Treino — Time a')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Notícia n1')).toBeOnTheScreen()
    expect(noticiasApi).toHaveBeenCalledTimes(2)
    expect(eventosApi).toHaveBeenCalledTimes(1)
  })

  it('offline com cache: dados e uma faixa "Modo offline" (critério 14)', async () => {
    await abrirHome()
    await screen.findByText('Notícia n1')
    await screen.findByText('Treino — Time a')

    await act(() => onlineManager.setOnline(false))

    expect(
      screen.getAllByText(/^Modo offline · dados de \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/),
    ).toHaveLength(1)
    expect(screen.getByText('Treino — Time a')).toBeOnTheScreen()
    expect(screen.getByText('Notícia n1')).toBeOnTheScreen()
  })

  it('offline só com banners em cache: carrossel e faixa "Modo offline" (#33, critério 15)', async () => {
    onlineManager.setOnline(false)
    cliente.setQueryData(chaves.banners(), [
      { id: 'b1', titulo: 'Banner b1', imagemUrl: 'https://img.exemplo.com/b1.jpg', link: null },
    ])
    await abrirHome()

    expect(await screen.findByText('Banner b1')).toBeOnTheScreen()
    expect(screen.getByText(/^Modo offline · dados de/)).toBeOnTheScreen()
  })

  it('offline sem cache: estado "Sem conexão" em cada seção, sem faixa (critério 14)', async () => {
    onlineManager.setOnline(false)
    await abrirHome()

    expect(
      await screen.findAllByText('Sem conexão. Conecte-se à internet para carregar os dados.'),
    ).toHaveLength(2)
    expect(screen.queryByText(/^Modo offline/)).toBeNull()
  })

  it('pull-to-refresh recarrega as seções e os banners', async () => {
    await abrirHome()
    await screen.findByText('Notícia n1')
    await screen.findByText('Treino — Time a')

    await act(() => refreshControl().props.onRefresh?.())

    await waitFor(() => expect(eventosApi).toHaveBeenCalledTimes(2))
    expect(noticiasApi).toHaveBeenCalledTimes(2)
    expect(bannersApi).toHaveBeenCalledTimes(2)
  })

  it('sem banner ativo: sem carrossel e o restante normal (#33 critério 4)', async () => {
    await abrirHome()
    await screen.findByText('Notícia n1')
    expect(screen.queryByTestId('carrossel-banners')).toBeNull()
  })

  it('carrossel no topo, antes dos atalhos (#33 critério 1)', async () => {
    bannersApi.mockResolvedValue([
      { id: 'b1', titulo: 'Inscrições JUBS', imagemUrl: 'https://img/b1.webp', link: null },
    ])
    await abrirHome()
    expect(await screen.findByText('Inscrições JUBS')).toBeOnTheScreen()
    const marcos = screen
      .getAllByText(/^(Inscrições JUBS|Placar)$/)
      .map(({ props }) => props.children as string)
    expect(marcos).toEqual(['Inscrições JUBS', 'Placar'])
  })

  it.each([
    ['Agenda', 'aoAbrirAgenda', 'eventos'],
    ['Placar', 'aoAbrirAgenda', 'placar'],
    ['Times', 'aoAbrirTimes', undefined],
    ['Notícias', 'aoAbrirNoticias', undefined],
  ] as const)('atalho "%s" (critério 18)', async (rotulo, acao, argumento) => {
    await abrirHome()
    await fireEvent.press(screen.getByRole('button', { name: rotulo }))
    if (argumento) expect(navegacao[acao]).toHaveBeenCalledWith(argumento)
    else expect(navegacao[acao]).toHaveBeenCalled()
  })

  it('"Ver agenda", "Ver todas" e o avatar navegam', async () => {
    await abrirHome()
    await fireEvent.press(screen.getByRole('link', { name: 'Ver agenda' }))
    expect(navegacao.aoAbrirAgenda).toHaveBeenCalledWith('eventos')
    await fireEvent.press(screen.getByRole('link', { name: 'Ver todas' }))
    expect(navegacao.aoAbrirNoticias).toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir perfil' }))
    expect(navegacao.aoAbrirPerfil).toHaveBeenCalled()
  })

  it('span de abertura: Home pronta só quando as duas seções respondem, mesmo com erro', async () => {
    const pronta = jest.mocked(useMarcarHomePronta)
    eventosApi.mockRejectedValue(falha())
    let responderNoticias!: (lista: ListaNoticias) => void
    noticiasApi.mockReturnValue(new Promise((resolver) => (responderNoticias = resolver)))
    await abrirHome()

    await screen.findByText('Não foi possível carregar os eventos')
    expect(pronta).toHaveBeenLastCalledWith(false)

    await act(() => responderNoticias(listaNoticias([noticia('n1')])))
    expect(await screen.findByText('Notícia n1')).toBeOnTheScreen()
    expect(pronta).toHaveBeenLastCalledWith(true)
  })

  it('cabeçalho usa nome e sigla da atlética, sem nome fixo (RNF20)', async () => {
    cliente.setQueryData(chaves.atletica(), {
      id: 'a1',
      nome: 'Atlética de Computação',
      sigla: 'AAC',
      curso: null,
      logoUrl: null,
      corPrimaria: '#123456',
      corSecundaria: '#654321',
      contatoEmail: null,
      contatoInstagram: null,
      contatoWhatsapp: null,
    })
    await abrirHome()

    expect(screen.getByRole('header', { name: 'Atlética de Computação' })).toBeOnTheScreen()
    expect(screen.getByText('AAC')).toBeOnTheScreen()
  })
})
