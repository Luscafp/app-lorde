import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  formatarDataHora,
  Papel,
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
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'
import { MENSAGEM_SEM_CONEXAO } from '@/components/estado'
import { toast } from '@/components/ui/toast'
import { sair } from '@/features/auth/logout'
import { TelaAgenda, type AbaAgenda } from '@/features/eventos'
import * as apiEventos from '@/features/eventos/api'
import { TelaHome } from '@/features/home'
import * as apiNoticias from '@/features/noticias/api'
import { api } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import {
  BUSTER,
  CACHE_SCHEMA_VERSION,
  chaveCache,
  criarPersister,
  MAX_AGE,
  metaPersistida,
  opcoesPersistencia,
  persistida,
  shouldDehydrateQuery,
} from '@/infra/query/persistencia'
import { criarQueryClient } from '@/infra/query/query-client'
import { MENSAGEM_ACAO_OFFLINE, useAcaoOnline } from '@/infra/query/use-acao-online'
import { useSessao, type UsuarioSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))
jest.mock('@/features/eventos/api', () => ({ LIMITE_PAGINA: 20, listarEventos: jest.fn() }))
jest.mock('@/features/noticias/api', () => ({ LIMITE_PAGINA: 20, listarNoticias: jest.fn() }))
jest.mock('@/features/modalidades/api')
jest.mock('@/features/atletica/api')
jest.mock('@/infra/sentry', () => ({
  ...jest.requireActual<object>('@/infra/sentry'),
  useMarcarHomePronta: jest.fn(),
}))

const listarEventos = jest.mocked(apiEventos.listarEventos)
const listarNoticias = jest.mocked(apiNoticias.listarNoticias)

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

const PERFIL: Perfil = {
  id: 'usuario',
  nome: 'Ana',
  email: 'ana@exemplo.com',
  fotoUrl: null,
  papel: Papel.ATLETA,
  times: [],
} as unknown as Perfil

const salvar = (cliente: QueryClient) =>
  persistQueryClientSave({
    queryClient: cliente,
    persister: criarPersister(usuario.id),
    buster: BUSTER,
    dehydrateOptions: { shouldDehydrateQuery },
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
})

afterEach(async () => {
  await descartarCliente()
  onlineManager.setOnline(true)
})

describe('o que é persistido', () => {
  it('versão do cache e idade máxima de 7 dias', () => {
    expect(BUSTER).toMatch(new RegExp(`-${CACHE_SCHEMA_VERSION}$`))
    expect(MAX_AGE).toBe(7 * 24 * HORA)
    expect(persistida).toEqual({ meta: metaPersistida, gcTime: MAX_AGE })
  })

  it('shouldDehydrateQuery aceita só queries com meta.persistir e status success', async () => {
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
    expect(shouldDehydrateQuery(query('com-meta'))).toBe(true)
    expect(shouldDehydrateQuery(query('sem-meta'))).toBe(false)
    expect(shouldDehydrateQuery(query('com-erro'))).toBe(false)
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

  it("['me'] vai sem e-mail e o AsyncStorage não tem tokens (critério 12)", async () => {
    await cliente.fetchQuery({ queryKey: chaves.me(), queryFn: () => PERFIL, ...persistida })

    await salvar(cliente)

    const bruto = (await AsyncStorage.getItem(chaveCache(usuario.id)))!
    expect(bruto).toContain('"nome":"Ana"')
    expect(bruto).not.toContain('ana@exemplo.com')
    expect(bruto).not.toContain('token-de-acesso')
    expect(bruto).not.toContain('token-de-refresh')
  })

  it("na restauração, o e-mail do ['me'] volta da sessão local", async () => {
    await cliente.fetchQuery({ queryKey: chaves.me(), queryFn: () => PERFIL, ...persistida })
    await salvar(cliente)
    cliente.clear()

    await persistQueryClientRestore({ ...opcoesPersistencia, queryClient: cliente })

    expect(cliente.getQueryData(chaves.me())).toEqual(PERFIL)
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
      dehydrateOptions: { shouldDehydrateQuery },
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
  it('Agenda, Placar e Home mostram os dados e a faixa com a data do dado salvo (critério 1)', async () => {
    deslocarRelogio(-2 * HORA)
    await abrirOnlineESalvar(agenda('eventos'), 'Lorde Vôlei × Atlética Medicina')
    await abrirOnlineESalvar(agenda('placar'), 'Lorde Futsal')
    await abrirOnlineESalvar(<TelaHome {...navegacaoHome} />, 'Calourada 2026')
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

    expect(listarEventos).not.toHaveBeenCalled()
    expect(listarNoticias).not.toHaveBeenCalled()
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
  ] as const)('%s remove rq-cache:<usuarioId>', async (_, motivo) => {
    await comCacheSalvo()

    await useSessao.getState().encerrarSessao({ motivo })

    await waitFor(async () => expect(await AsyncStorage.getItem(chaveCache(usuario.id))).toBeNull())
  })

  it('logout offline também apaga o cache local (critério 10)', async () => {
    await comCacheSalvo()
    onlineManager.setOnline(false)

    await sair()

    expect(useSessao.getState().status).toBe('anonimo')
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

    await api.get('/eventos').catch(() => undefined)

    expect(useSessao.getState().status).toBe('anonimo')
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
      buster: BUSTER,
      timestamp: agoraReal(),
      clientState: { queries: [], mutations: [] },
    })

    expect(await AsyncStorage.getItem(chaveCache(idDeA))).toBeNull()
  })

  it('sem sessão, nada é restaurado nem gravado', async () => {
    await useSessao.getState().encerrarSessao({ motivo: 'LOGOUT' })
    await opcoesPersistencia.persister.persistClient({
      buster: BUSTER,
      timestamp: agoraReal(),
      clientState: { queries: [], mutations: [] },
    })

    expect(await opcoesPersistencia.persister.restoreClient()).toBeUndefined()
    expect(await AsyncStorage.getAllKeys()).not.toContainEqual(expect.stringMatching(/^rq-cache:/))
  })
})
