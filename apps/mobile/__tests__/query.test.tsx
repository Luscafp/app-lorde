import NetInfo from '@react-native-community/netinfo'
import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { toast } from '@/components/ui/toast'
import { ApiErro, CodigoLocal } from '@/infra/api/cliente'
import { chaves } from '@/infra/query/chaves'
import { criarQueryClient, deveRepetir, queryClient } from '@/infra/query/query-client'
import { MENSAGEM_ACAO_OFFLINE, useAcaoOnline } from '@/infra/query/use-acao-online'
import { configurarRede, estaOnline, useOnline } from '@/infra/rede/online'
import { useSessao } from '@/infra/sessao/store'

jest.mock('@/components/ui/toast', () => ({
  toast: { sucesso: jest.fn(), erro: jest.fn(), info: jest.fn() },
}))

const netInfo = NetInfo as unknown as { __emitir: (estado: object) => void }

const emitirRede = (isConnected: boolean | null, isInternetReachable: boolean | null) =>
  act(() => netInfo.__emitir({ isConnected, isInternetReachable }))

let cliente: QueryClient

function comQuery({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

const apiErro = (status: number, code: string, message = 'Erro.') =>
  new ApiErro({ status, code, message })

beforeAll(() => configurarRede())

beforeEach(async () => {
  cliente = criarQueryClient()
  jest.mocked(toast.erro).mockClear()
  await emitirRede(true, true)
})

afterEach(() => cliente.clear())

describe('online.ts', () => {
  it.each([
    [true, true, true],
    [true, null, true],
    [null, null, true],
    [false, null, false],
    [true, false, false],
    [false, false, false],
  ])('isConnected=%s, isInternetReachable=%s → online=%s', (conectado, alcancavel, online) => {
    expect(estaOnline({ isConnected: conectado, isInternetReachable: alcancavel })).toBe(online)
  })

  it('NetInfo alimenta o onlineManager e o useOnline()', async () => {
    const { result } = await renderHook(() => useOnline())

    await emitirRede(true, null)
    expect(result.current).toBe(true)
    expect(onlineManager.isOnline()).toBe(true)

    await emitirRede(true, false)
    expect(result.current).toBe(false)
    expect(onlineManager.isOnline()).toBe(false)
  })
})

describe('QueryClient', () => {
  it('configura staleTime 60 s, gcTime 24 h e refetchOnReconnect', () => {
    expect(cliente.getDefaultOptions().queries).toMatchObject({
      staleTime: 60_000,
      gcTime: 24 * 60 * 60_000,
      refetchOnReconnect: true,
    })
  })

  it.each([
    [0, apiErro(0, CodigoLocal.SEM_CONEXAO), true],
    [1, apiErro(0, CodigoLocal.TEMPO_ESGOTADO), true],
    [0, apiErro(503, 'ARMAZENAMENTO_INDISPONIVEL'), true],
    [2, apiErro(500, 'INTERNAL_ERROR'), false],
    [0, apiErro(404, 'NOT_FOUND'), false],
    [0, apiErro(401, 'UNAUTHENTICATED'), false],
    [0, new Error('x'), false],
  ])('com %s falha(s), repete %p? %s', (falhas, erro, repete) => {
    expect(deveRepetir(falhas, erro)).toBe(repete)
  })

  it('encerrar a sessão limpa o cache de queries', async () => {
    queryClient.setQueryData(chaves.me(), { nome: 'Ana' })

    await useSessao.getState().encerrarSessao({ motivo: 'LOGOUT' })

    expect(queryClient.getQueryData(chaves.me())).toBeUndefined()
  })
})

describe('useAcaoOnline', () => {
  it('online, chama a mutationFn', async () => {
    const mutationFn = jest.fn((_: string) => Promise.resolve('ok'))
    const { result } = await renderHook(() => useAcaoOnline({ mutationFn }), { wrapper: comQuery })

    expect(result.current.online).toBe(true)
    await act(async () => {
      await result.current.mutateAsync('x')
    })

    expect(mutationFn).toHaveBeenCalledWith('x', expect.anything())
    await waitFor(() => expect(result.current.data).toBe('ok'))
  })

  it('offline, não chama a mutationFn e mostra o toast de sem conexão', async () => {
    const mutationFn = jest.fn(() => Promise.resolve())
    const { result } = await renderHook(() => useAcaoOnline({ mutationFn }), { wrapper: comQuery })

    await emitirRede(false, null)
    expect(result.current.online).toBe(false)
    await act(() => result.current.mutate())

    expect(mutationFn).not.toHaveBeenCalled()
    expect(toast.erro).toHaveBeenCalledWith(MENSAGEM_ACAO_OFFLINE)
    expect(toast.erro).toHaveBeenCalledTimes(1)
  })

  it('offline, mutateAsync rejeita com SEM_CONEXAO', async () => {
    const mutationFn = jest.fn(() => Promise.resolve())
    const { result } = await renderHook(() => useAcaoOnline({ mutationFn }), { wrapper: comQuery })

    await emitirRede(false, false)

    await expect(result.current.mutateAsync()).rejects.toMatchObject({
      code: CodigoLocal.SEM_CONEXAO,
      message: MENSAGEM_ACAO_OFFLINE,
    })
    expect(mutationFn).not.toHaveBeenCalled()
  })

  it('erro 409 mostra a message da API no toast global', async () => {
    const mutationFn = () =>
      Promise.reject(apiErro(409, 'TIME_DUPLICADO', 'Já existe um time com esse nome.'))
    const { result } = await renderHook(() => useAcaoOnline({ mutationFn }), { wrapper: comQuery })

    await act(() => result.current.mutate())

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.erro).toHaveBeenCalledWith('Já existe um time com esse nome.')
  })

  it('sessão encerrada não repete o toast (o encerramento já mostrou o seu)', async () => {
    const mutationFn = () => Promise.reject(apiErro(401, CodigoLocal.SESSAO_ENCERRADA))
    const { result } = await renderHook(() => useAcaoOnline({ mutationFn }), { wrapper: comQuery })

    await act(() => result.current.mutate())

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.erro).not.toHaveBeenCalled()
  })
})
