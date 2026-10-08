import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  formatarDataHora,
  Papel,
  type EventoDetalheDto,
  type EventoResumoDto,
  type ListaEventos,
  type ListaNoticias,
  type Perfil,
} from '@atletica/shared'
import * as Sentry from '@sentry/react-native'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  persistQueryClientRestore,
  persistQueryClientSave,
  PersistQueryClientProvider,
} from '@tanstack/react-query-persist-client'
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'
import { MENSAGEM_SEM_CONEXAO } from '@/components/estado'
import { toast } from '@/components/ui/toast'
import { sair } from '@/features/auth/logout'
import { TelaAgenda, TelaEvento, type AbaAgenda } from '@/features/eventos'
import * as apiEventos from '@/features/eventos/api'
import { TelaHome } from '@/features/home'
import { TelaNoticia } from '@/features/noticias'
import * as apiNoticias from '@/features/noticias/api'
import { ParticipacaoAcoes } from '@/features/participacoes'
import { ListaUsuarios } from '@/features/usuarios'
import * as apiUsuarios from '@/features/usuarios/api'
import { api } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import {
  chaveCache,
  criarPersister,
  deveDesidratar,
  IDADE_MAXIMA_CACHE_MS,
  metaPersistida,
  opcoesPersistencia,
  persistida,
  VERSAO_CACHE,
  VERSAO_FORMATO_CACHE,
} from '@/infra/query/persistencia'
import { criarQueryClient, queryClient } from '@/infra/query/query-client'
import { MENSAGEM_ACAO_OFFLINE, useAcaoOnline } from '@/infra/query/use-acao-online'
import { useSessao, type UsuarioSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/eventos/api', () => ({
  LIMITE_PAGINA: 20,
  listarEventos: jest.fn(),
  buscarEvento: jest.fn(),
}))
jest.mock('@/features/noticias/api', () => ({
  LIMITE_PAGINA: 20,
  listarNoticias: jest.fn(),
  buscarNoticia: jest.fn(),
}))
jest.mock('@/features/usuarios/api', () => ({ LIMITE_PAGINA: 20, listarUsuarios: jest.fn() }))
jest.mock('@/features/modalidades/api')
jest.mock('@/features/atletica/api')
jest.mock('@/infra/sentry', () => ({
  ...jest.requireActual<object>('@/infra/sentry'),
  useMarcarHomePronta: jest.fn(),
}))

const listarEventos = jest.mocked(apiEventos.listarEventos)
const buscarEvento = jest.mocked(apiEventos.buscarEvento)
const listarNoticias = jest.mocked(apiNoticias.listarNoticias)
const buscarNoticia = jest.mocked(apiNoticias.buscarNoticia)
const listarUsuarios = jest.mocked(apiUsuarios.listarUsuarios)

const HORA = 60 * 60_000
const agoraReal = Date.now.bind(Date)
const deslocarRelogio = (ms: number) =>
  jest.spyOn(Date, 'now').mockImplementation(() => agoraReal() + ms)

let sequencia = 0
let usuario: UsuarioSessao

const novoUsuario = (): UsuarioSessao => ({
  id: `usuario-${++sequencia}`,
  nome: 'Ana',
  email: 'ana@exemplo.com',
  fotoUrl: null,
  papel: Papel.ATLETA,
  atleticaId: 'atletica-1',
})

const entrar = (dados: UsuarioSessao) =>
  useSessao.getState().iniciarSessao({
    accessToken: 'token-de-acesso',
    refreshToken: 'token-de-refresh',
    accessTokenExpiraEm: new Date(agoraReal() + HORA).toISOString(),
    usuario: dados,
  })

const evento = (id: string, parcial: Partial<EventoResumoDto> = {}): EventoResumoDto => ({
  id,
  tipo: 'JOGO',
  status: 'AGENDADO',
  inicio: '2030-10-09T22:00:00.000Z',
  local: 'Ginásio',
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

const JOGO = evento('jogo')
const ENCERRADO = evento('encerrado', {
  status: 'FINALIZADO',
  inicio: '2026-09-20T22:00:00.000Z',
  time: { id: 't1', nome: 'Lorde Futsal' },
  placarTime: 3,
  placarAdversario: 1,
  resultado: 'VITORIA',
})

const paginaEventos = (items: EventoResumoDto[], page = 1, total = items.length): ListaEventos => ({
  items,
  page,
  limit: 20,
  total,
})

const paginaNoticias = (titulos: string[]): ListaNoticias => ({
  items: titulos.map((titulo, i) => ({
    id: `n${i}`,
    titulo,
    imagemCapaUrl: null,
    publicadaEm: '2026-09-28T18:00:00.000Z',
    resumo: 'Resumo.',
  })),
  page: 1,
  limit: 3,
  total: titulos.length,
})

const DETALHE_JOGO: EventoDetalheDto = {
  ...JOGO,
  observacoes: null,
  criadoEm: '2026-10-01T12:00:00.000Z',
  atualizadoEm: '2026-10-01T12:00:00.000Z',
  serie: null,
  contagem: { confirmados: 8, recusados: 2, semResposta: 4, elenco: 14 },
  confirmados: [],
  souMembro: true,
  podeResponder: true,
  motivoBloqueioResposta: null,
}

const perfilDe = ({ id, email }: UsuarioSessao): Perfil => ({
  id,
  nome: 'Ana',
  email,
  fotoUrl: null,
  emailVerificado: true,
  papel: Papel.ATLETA,
  atletica: { id: 'atletica-1', nome: 'Atlética Lorde', sigla: 'LORDE' },
  times: [],
  termosAceitos: { versao: '1', aceitoEm: '2026-09-01T12:00:00.000Z' },
  criadoEm: '2026-09-01T12:00:00.000Z',
})

const salvar = (cliente: QueryClient) =>
  persistQueryClientSave({
    queryClient: cliente,
    persister: criarPersister(usuario.id),
    buster: VERSAO_CACHE,
    dehydrateOptions: { shouldDehydrateQuery: deveDesidratar },
  })

const lerSalvo = async () => {
  const bruto = await AsyncStorage.getItem(chaveCache(usuario.id))
  return bruto === null ? null : (JSON.parse(bruto) as { clientState: { queries: unknown[] } })
}

const chavesSalvas = async () =>
  ((await lerSalvo())?.clientState.queries ?? []).map(
    (query) => (query as { queryKey: unknown }).queryKey,
  )

let cliente: QueryClient

function Online({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

function Restaurado({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider client={cliente} persistOptions={opcoesPersistencia}>
      {children}
    </PersistQueryClientProvider>
  )
}

const navegacaoHome = {
  aoAbrirAgenda: jest.fn(),
  aoAbrirTimes: jest.fn(),
  aoAbrirNoticias: jest.fn(),
  aoAbrirEvento: jest.fn(),
  aoAbrirNoticia: jest.fn(),
  aoAbrirPerfil: jest.fn(),
  aoVerificarEmail: jest.fn(),
}

const agenda = (aba: AbaAgenda) => (
  <TelaAgenda
    aba={aba}
    aoMudarAba={jest.fn()}
    filtros={{}}
    aoMudarFiltros={jest.fn()}
    aoAbrirEvento={jest.fn()}
  />
)

/** Abre a tela online, espera os dados e grava o cache como o persister faria. */
async function abrirOnlineESalvar(tela: ReactElement, textoEsperado: string) {
  const { unmount } = await render(tela, { wrapper: Online })
  await screen.findByText(textoEsperado)
  await salvar(cliente)
  await unmount()
}

/** Busca pausada offline agenda o gc de 7 dias ao terminar: cancela antes de limpar, ou o Jest não sai. */
async function descartarCliente() {
  await cleanup()
  await cliente.cancelQueries()
  cliente.clear()
}

async function trocarCliente() {
  await descartarCliente()
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
}

/** Remonta o app offline: cliente novo, restaurado do AsyncStorage. */
async function reabrirOffline(tela: ReactElement) {
  await trocarCliente()
  onlineManager.setOnline(false)
  return render(tela, { wrapper: Restaurado })
}

beforeEach(async () => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  await AsyncStorage.clear()
  usuario = novoUsuario()
  await entrar(usuario)
  cliente = criarQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false } })
  onlineManager.setOnline(true)
  listarEventos.mockImplementation((filtros) =>
    Promise.resolve(paginaEventos(filtros.status === 'FINALIZADO' ? [ENCERRADO] : [JOGO])),
  )
  listarNoticias.mockResolvedValue(paginaNoticias(['Calourada 2026']))
  buscarNoticia.mockResolvedValue({
    ...paginaNoticias(['Calourada 2026']).items[0]!,
    conteudo: 'Programação da semana.',
  })
  buscarEvento.mockResolvedValue(DETALHE_JOGO)
})

afterEach(async () => {
  await descartarCliente()
  onlineManager.setOnline(true)
})

describe('o que é persistido', () => {
  it('versão do cache e idade máxima de 7 dias', () => {
    expect(VERSAO_CACHE).toMatch(new RegExp(`-${VERSAO_FORMATO_CACHE}$`))
    expect(IDADE_MAXIMA_CACHE_MS).toBe(7 * 24 * HORA)
    expect(persistida).toEqual({ meta: metaPersistida, gcTime: IDADE_MAXIMA_CACHE_MS })
  })

  it('deveDesidratar aceita só queries com meta.persistir e status success', async () => {
    await cliente.fetchQuery({ queryKey: ['com-meta'], queryFn: () => 1, ...persistida })
    await cliente.fetchQuery({ queryKey: ['sem-meta'], queryFn: () => 1 })
    await cliente
      .fetchQuery({
        queryKey: ['com-erro'],
        queryFn: () => Promise.reject(new Error('x')),
        ...persistida,
      })
      .catch(() => undefined)

    const query = (chave: string) => cliente.getQueryCache().find({ queryKey: [chave] })!
    expect(deveDesidratar(query('com-meta'))).toBe(true)
    expect(deveDesidratar(query('sem-meta'))).toBe(false)
    expect(deveDesidratar(query('com-erro'))).toBe(false)
  })

  it('lista de usuários do painel não é persistida (critério 9)', async () => {
    await cliente.fetchQuery({
      queryKey: chaves.usuarios.lista({}),
      queryFn: () => ({ items: [] }),
    })
    await cliente.fetchQuery({
      queryKey: chaves.atletica(),
      queryFn: () => ({ nome: 'Lorde' }),
      ...persistida,
    })

    await salvar(cliente)

    expect(await chavesSalvas()).toEqual([chaves.atletica()])
  })

  it("['me'] guarda só nome, foto, papel e times; sem e-mail nem tokens (critério 12)", async () => {
    await cliente.fetchQuery({
      queryKey: chaves.me(),
      queryFn: () => perfilDe(usuario),
      ...persistida,
    })

    await salvar(cliente)

    const bruto = (await AsyncStorage.getItem(chaveCache(usuario.id)))!
    const [me] = (JSON.parse(bruto) as { clientState: { queries: { state: { data: unknown } }[] } })
      .clientState.queries
    expect(me!.state.data).toEqual({ nome: 'Ana', fotoUrl: null, papel: Papel.ATLETA, times: [] })
    expect(bruto).not.toContain('ana@exemplo.com')
    expect(bruto).not.toContain('token-de-acesso')
    expect(bruto).not.toContain('token-de-refresh')
  })

  it("na restauração, id e e-mail do ['me'] voltam da sessão local", async () => {
    await cliente.fetchQuery({
      queryKey: chaves.me(),
      queryFn: () => perfilDe(usuario),
      ...persistida,
    })
    await salvar(cliente)
    cliente.clear()

    await persistQueryClientRestore({ ...opcoesPersistencia, queryClient: cliente })

    expect(cliente.getQueryData(chaves.me())).toEqual({
      id: usuario.id,
      nome: 'Ana',
      email: usuario.email,
      fotoUrl: null,
      papel: Papel.ATLETA,
      times: [],
    })
  })

  it('lista infinita de eventos guarda só as 2 primeiras páginas; a de times guarda todas', async () => {
    const pagina = ({ pageParam }: { pageParam: number }) =>
      Promise.resolve(paginaEventos([evento(`e${pageParam}`)], pageParam, 99))
    const infinita = {
      queryFn: pagina,
      initialPageParam: 1,
      getNextPageParam: (_: unknown, __: unknown, p: number) => p + 1,
      pages: 3,
      ...persistida,
    }
    await cliente.fetchInfiniteQuery({ ...infinita, queryKey: chaves.eventos.lista({ limit: 20 }) })
    await cliente.fetchInfiniteQuery({ ...infinita, queryKey: chaves.times.lista({}) })

    await salvar(cliente)

    const queries = (await lerSalvo())!.clientState.queries as {
      queryKey: unknown[]
      state: { data: { pages: unknown[]; pageParams: unknown[] } }
    }[]
    const dados = (recurso: string) => queries.find((q) => q.queryKey[0] === recurso)!.state.data
    expect(dados('eventos').pages).toHaveLength(2)
    expect(dados('eventos').pageParams).toEqual([1, 2])
    expect(dados('times').pages).toHaveLength(3)
  })
})

describe('restauração', () => {
  it('cache com buster diferente é ignorado sem erro (critério 11)', async () => {
    await cliente.fetchQuery({
      queryKey: chaves.atletica(),
      queryFn: () => ({ nome: 'Lorde' }),
      ...persistida,
    })
    await persistQueryClientSave({
      queryClient: cliente,
      persister: criarPersister(usuario.id),
      buster: 'versao-antiga-0',
      dehydrateOptions: { shouldDehydrateQuery: deveDesidratar },
    })
    cliente.clear()

    await persistQueryClientRestore({ ...opcoesPersistencia, queryClient: cliente })

    expect(cliente.getQueryData(chaves.atletica())).toBeUndefined()
    expect(await AsyncStorage.getItem(chaveCache(usuario.id))).toBeNull()
  })

  it('cache corrompido é descartado e o app segue', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    await AsyncStorage.setItem(chaveCache(usuario.id), '{json inválido')

    await reabrirOffline(agenda('eventos'))

    expect(await screen.findByText(MENSAGEM_SEM_CONEXAO)).toBeOnTheScreen()
    expect(await AsyncStorage.getItem(chaveCache(usuario.id))).toBeNull()
  })

  it('armazenamento cheio: registra no Sentry e segue sem persistir', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disco cheio'))
    await cliente.fetchQuery({
      queryKey: chaves.atletica(),
      queryFn: () => ({ nome: 'Lorde' }),
      ...persistida,
    })

    await expect(salvar(cliente)).resolves.toBeUndefined()

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'disco cheio' }),
    )
    expect(await AsyncStorage.getItem(chaveCache(usuario.id))).toBeNull()
  })
})

describe('telas offline com o cache restaurado', () => {
  it('Agenda, Placar, Home e uma notícia mostram os dados e a faixa com a data do dado salvo (critério 1)', async () => {
    deslocarRelogio(-2 * HORA)
    await abrirOnlineESalvar(agenda('eventos'), 'Lorde Vôlei × Atlética Medicina')
    await abrirOnlineESalvar(agenda('placar'), 'Lorde Futsal')
    await abrirOnlineESalvar(<TelaHome {...navegacaoHome} />, 'Calourada 2026')
    await abrirOnlineESalvar(<TelaNoticia id="n0" />, 'Calourada 2026')
    const salvoEm = (await lerSalvo()) as unknown as {
      clientState: { queries: { queryKey: unknown[]; state: { dataUpdatedAt: number } }[] }
    }
    const atualizadoEm = (filtros: Record<string, unknown>) =>
      salvoEm.clientState.queries.find(
        (q) => JSON.stringify(q.queryKey) === JSON.stringify(chaves.eventos.lista(filtros)),
      )!.state.dataUpdatedAt
    jest.mocked(Date.now).mockRestore()
    listarEventos.mockClear()
    listarNoticias.mockClear()
    buscarNoticia.mockClear()

    const { unmount } = await reabrirOffline(agenda('eventos'))
    expect(await screen.findByText('Lorde Vôlei × Atlética Medicina')).toBeOnTheScreen()
    expect(
      screen.getByText(
        `Modo offline · dados de ${formatarDataHora(atualizadoEm({ periodo: 'PROXIMOS', limit: 20 }))}`,
      ),
    ).toBeOnTheScreen()
    await unmount()

    await reabrirOffline(agenda('placar'))
    expect(await screen.findByText('Lorde Futsal')).toBeOnTheScreen()
    expect(screen.getByText(/^Modo offline · dados de /)).toBeOnTheScreen()

    await reabrirOffline(<TelaHome {...navegacaoHome} />)
    expect(await screen.findByText('Calourada 2026')).toBeOnTheScreen()

    await reabrirOffline(<TelaNoticia id="n0" />)
    expect(await screen.findByText('Calourada 2026')).toBeOnTheScreen()
    expect(screen.getByText(/^Modo offline · dados de /)).toBeOnTheScreen()

    expect(listarEventos).not.toHaveBeenCalled()
    expect(listarNoticias).not.toHaveBeenCalled()
    expect(buscarNoticia).not.toHaveBeenCalled()
  })

  it('a conexão volta: a faixa some e as queries ativas são refeitas (critério 2)', async () => {
    await abrirOnlineESalvar(agenda('eventos'), 'Lorde Vôlei × Atlética Medicina')
    listarEventos.mockClear()

    await reabrirOffline(agenda('eventos'))
    await screen.findByText(/^Modo offline · dados de /)

    await act(() => onlineManager.setOnline(true))

    await waitFor(() => expect(listarEventos).toHaveBeenCalled())
    expect(screen.queryByText(/^Modo offline/)).toBeNull()
  })

  it('cache com mais de 7 dias é descartado: estado vazio-offline (critério 5)', async () => {
    deslocarRelogio(-8 * 24 * HORA)
    await abrirOnlineESalvar(agenda('eventos'), 'Lorde Vôlei × Atlética Medicina')
    jest.mocked(Date.now).mockRestore()

    await reabrirOffline(agenda('eventos'))

    expect(await screen.findByText(MENSAGEM_SEM_CONEXAO)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen()
    expect(screen.queryByText('Lorde Vôlei × Atlética Medicina')).toBeNull()
  })

  it('sem cache e offline: "Sem conexão" e "Tentar novamente" (critério 8)', async () => {
    await reabrirOffline(agenda('eventos'))

    expect(await screen.findByText(MENSAGEM_SEM_CONEXAO)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen()
  })

  it('com o cache restaurado e offline, uma ação não chama a mutationFn (critérios 3 e 4)', async () => {
    await abrirOnlineESalvar(agenda('eventos'), 'Lorde Vôlei × Atlética Medicina')
    await reabrirOffline(agenda('eventos'))
    await screen.findByText('Lorde Vôlei × Atlética Medicina')
    const mutationFn = jest.fn(() => Promise.resolve())

    const { result } = await renderHook(() => useAcaoOnline({ mutationFn }), {
      wrapper: Restaurado,
    })
    await act(() => result.current.mutate())

    expect(mutationFn).not.toHaveBeenCalled()
    expect(toast.erro).toHaveBeenCalledWith(MENSAGEM_ACAO_OFFLINE)
  })

  it('evento restaurado offline: "Vou" desabilitado e nenhuma requisição (critério 3)', async () => {
    const put = jest.spyOn(api, 'put')
    const telaEvento = (
      <TelaEvento
        id={JOGO.id}
        aoGerenciar={jest.fn()}
        acoesParticipacao={(evento) => (
          <ParticipacaoAcoes evento={evento} aoAbrirTime={jest.fn()} />
        )}
      />
    )
    await abrirOnlineESalvar(telaEvento, 'Ginásio')

    await reabrirOffline(telaEvento)
    const vou = await screen.findByRole('button', { name: 'Vou' })
    await fireEvent.press(vou)

    expect(vou).toBeDisabled()
    expect(screen.getByTestId('legenda-participacao')).toHaveTextContent('Sem conexão')
    expect(put).not.toHaveBeenCalled()
  })

  it('lista de usuários do painel não volta offline: estado vazio-offline (critério 9)', async () => {
    listarUsuarios.mockResolvedValue({
      items: [
        {
          id: 'u9',
          nome: 'José Lima',
          email: 'jose@ex.com',
          fotoUrl: null,
          papel: 'DIRETOR',
          situacao: 'ATIVO',
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
    })
    await abrirOnlineESalvar(<ListaUsuarios aoAbrir={jest.fn()} />, 'José Lima')

    await reabrirOffline(<ListaUsuarios aoAbrir={jest.fn()} />)

    expect(await screen.findByText(MENSAGEM_SEM_CONEXAO)).toBeOnTheScreen()
    expect(screen.queryByText('José Lima')).toBeNull()
  })
})

describe('limpeza ao sair da sessão', () => {
  async function comCacheSalvo() {
    await cliente.fetchQuery({
      queryKey: chaves.atletica(),
      queryFn: () => ({ nome: 'Lorde' }),
      ...persistida,
    })
    await salvar(cliente)
    expect(await AsyncStorage.getItem(chaveCache(usuario.id))).not.toBeNull()
  }

  it.each([
    ['logout', 'LOGOUT'],
    ['exclusão de conta', 'CONTA_EXCLUIDA'],
  ] as const)('%s remove rq-cache:<usuarioId> e limpa o QueryClient', async (_, motivo) => {
    await comCacheSalvo()
    const limpar = jest.spyOn(queryClient, 'clear')

    await useSessao.getState().encerrarSessao({ motivo })

    expect(limpar).toHaveBeenCalled()
    await waitFor(async () => expect(await AsyncStorage.getItem(chaveCache(usuario.id))).toBeNull())
  })

  it('logout offline também apaga o cache local (critério 10)', async () => {
    await comCacheSalvo()
    onlineManager.setOnline(false)
    const limpar = jest.spyOn(queryClient, 'clear')

    await sair()

    expect(useSessao.getState().status).toBe('anonimo')
    expect(limpar).toHaveBeenCalled()
    await waitFor(async () => expect(await AsyncStorage.getItem(chaveCache(usuario.id))).toBeNull())
  })

  it('refresh 401 encerra a sessão e limpa o cache persistido (critério 7)', async () => {
    await comCacheSalvo()
    useSessao.setState({ accessToken: null })
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        headers: { get: () => null },
        text: () =>
          Promise.resolve(
            JSON.stringify({ statusCode: 401, code: 'SESSAO_REVOGADA', message: 'x' }),
          ),
      } as unknown as Response),
    )

    const limpar = jest.spyOn(queryClient, 'clear')

    await api.get('/eventos').catch(() => undefined)

    expect(useSessao.getState().status).toBe('anonimo')
    expect(limpar).toHaveBeenCalled()
    await waitFor(async () => expect(await AsyncStorage.getItem(chaveCache(usuario.id))).toBeNull())
  })

  it('B entra no mesmo aparelho depois de A e não vê o cache de A (critério 6)', async () => {
    await comCacheSalvo()
    await useSessao.getState().encerrarSessao({ motivo: 'LOGOUT' })
    usuario = novoUsuario()
    await entrar(usuario)
    await trocarCliente()

    await persistQueryClientRestore({ ...opcoesPersistencia, queryClient: cliente })

    expect(cliente.getQueryData(chaves.atletica())).toBeUndefined()
  })

  it('gravação atrasada de A não é escrita depois que a sessão mudou', async () => {
    const persisterDeA = criarPersister(usuario.id)
    const idDeA = usuario.id
    await entrar(novoUsuario())

    await persisterDeA.persistClient({
      buster: VERSAO_CACHE,
      timestamp: agoraReal(),
      clientState: { queries: [], mutations: [] },
    })

    expect(await AsyncStorage.getItem(chaveCache(idDeA))).toBeNull()
  })

  it('sem sessão, nada é restaurado nem gravado', async () => {
    await useSessao.getState().encerrarSessao({ motivo: 'LOGOUT' })
    await opcoesPersistencia.persister.persistClient({
      buster: VERSAO_CACHE,
      timestamp: agoraReal(),
      clientState: { queries: [], mutations: [] },
    })

    expect(await opcoesPersistencia.persister.restoreClient()).toBeUndefined()
    expect(await AsyncStorage.getAllKeys()).not.toContainEqual(expect.stringMatching(/^rq-cache:/))
  })
})
