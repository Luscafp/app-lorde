import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AtleticaPublica } from '@atletica/shared'
import NetInfo from '@react-native-community/netinfo'
import { onlineManager, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import * as nativewind from 'nativewind'
import type { ReactNode } from 'react'
import { StyleSheet, Text } from 'react-native'
import { carregarAtletica, corTextoSobre, ProvedorTema, useAtletica } from '@/features/atletica'
import { CHAVE_CACHE_ATLETICA } from '@/features/atletica/api'
import { hexParaRgb } from '@/features/atletica/cores'
import { variaveisTema } from '@/features/atletica/provedor-tema'
import { COR_NEUTRA, NOME_GENERICO } from '@/features/atletica/use-atletica'
import { chaves } from '@/infra/query/chaves'
import { queryClient } from '@/infra/query/query-client'
import { configurarRede } from '@/infra/rede/online'

const atletica: AtleticaPublica = {
  id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11',
  nome: 'Atlética Exemplo',
  sigla: 'EXEMPLO',
  curso: 'Computação',
  logoUrl: null,
  corPrimaria: '#E11D48',
  corSecundaria: '#2563EB',
  contatoEmail: null,
  contatoInstagram: null,
  contatoWhatsapp: null,
}

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>()
const netInfo = NetInfo as unknown as { __emitir: (estado: object) => void }

function resposta(corpo: unknown, status = 200): Response {
  return {
    ok: status < 400,
    status,
    headers: { get: () => null },
    text: () => Promise.resolve(JSON.stringify(corpo)),
  } as unknown as Response
}

function comQuery({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const renderAtletica = () => renderHook(() => useAtletica(), { wrapper: comQuery })

beforeEach(async () => {
  global.fetch = fetchMock
  fetchMock.mockReset()
  await AsyncStorage.clear()
  queryClient.clear()
  onlineManager.setOnline(true)
})

afterEach(() => {
  jest.useRealTimers()
  queryClient.clear()
})

describe('cores', () => {
  it('converte hex para "R G B"', () => {
    expect(hexParaRgb('#E11D48')).toBe('225 29 72')
    expect(hexParaRgb('#6b7280')).toBe('107 114 128')
  })

  it.each([
    ['#E11D48', '#FFFFFF'],
    ['#2563EB', '#FFFFFF'],
    ['#000000', '#FFFFFF'],
    ['#FFFFFF', '#000000'],
    ['#FACC15', '#000000'],
    ['#6B7280', '#FFFFFF'],
  ])('corTextoSobre(%s) = %s', (fundo, texto) => {
    expect(corTextoSobre(fundo)).toBe(texto)
  })

  it('rejeita cor inválida', () => {
    expect(() => hexParaRgb('vermelho')).toThrow('Cor inválida')
  })
})

describe('carregarAtletica e useAtletica', () => {
  it('busca GET /atletica pelo cliente HTTP, sem token, e grava o cache atletica.v1', async () => {
    fetchMock.mockResolvedValue(resposta(atletica))

    await carregarAtletica()

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toMatch(/\/atletica$/)
    expect(init?.headers).not.toHaveProperty('Authorization')
    const { result } = await renderAtletica()
    expect(result.current).toEqual(atletica)
    expect(JSON.parse((await AsyncStorage.getItem(CHAVE_CACHE_ATLETICA)) ?? '')).toEqual(atletica)
  })

  it('usa o cache como dado inicial, sem esperar a rede, e atualiza em segundo plano', async () => {
    await AsyncStorage.setItem(CHAVE_CACHE_ATLETICA, JSON.stringify(atletica))
    let liberarRede: (resposta: Response) => void = () => undefined
    fetchMock.mockReturnValue(new Promise<Response>((resolver) => (liberarRede = resolver)))

    await carregarAtletica()
    const { result } = await renderAtletica()
    expect(result.current.corPrimaria).toBe('#E11D48')

    await act(() => liberarRede(resposta({ ...atletica, corPrimaria: '#16A34A' })))
    await waitFor(() => expect(result.current.corPrimaria).toBe('#16A34A'))
  })

  it('sem rede e sem cache usa o fallback neutro sem travar', async () => {
    jest.useFakeTimers()
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))

    const carga = carregarAtletica()
    await jest.advanceTimersByTimeAsync(3000)
    await carga

    expect(queryClient.getQueryData(chaves.atletica())).toBeUndefined()
    const { result } = await renderAtletica()
    expect(result.current).toMatchObject({
      id: null,
      nome: NOME_GENERICO,
      corPrimaria: COR_NEUTRA,
      corSecundaria: COR_NEUTRA,
    })
  })

  it('sem rede e com cache usa o cache', async () => {
    await AsyncStorage.setItem(CHAVE_CACHE_ATLETICA, JSON.stringify(atletica))
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))

    await carregarAtletica()

    const { result } = await renderAtletica()
    expect(result.current).toEqual(atletica)
  })

  it('não segura a abertura mais de 3 s esperando a rede', async () => {
    jest.useFakeTimers()
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined))
    let terminou = false

    const carga = carregarAtletica().then(() => (terminou = true))
    await jest.advanceTimersByTimeAsync(2999)
    expect(terminou).toBe(false)
    await jest.advanceTimersByTimeAsync(1)
    await carga

    expect(terminou).toBe(true)
  })

  it('primeira abertura sem rede tenta de novo ao reconectar', async () => {
    configurarRede()
    await act(() => netInfo.__emitir({ isConnected: false, isInternetReachable: false }))
    fetchMock.mockResolvedValue(resposta(atletica))

    const { result } = await renderAtletica()
    expect(result.current.nome).toBe(NOME_GENERICO)
    expect(fetchMock).not.toHaveBeenCalled()

    await act(() => netInfo.__emitir({ isConnected: true, isInternetReachable: true }))
    await waitFor(() => expect(result.current.nome).toBe(atletica.nome))
  })

  it('ignora resposta fora do contrato', async () => {
    fetchMock.mockResolvedValue(resposta({ ...atletica, corPrimaria: 'vermelho' }))

    await carregarAtletica()

    expect(queryClient.getQueryData(chaves.atletica())).toBeUndefined()
    expect(await AsyncStorage.getItem(CHAVE_CACHE_ATLETICA)).toBeNull()
  })

  it('cor nula na API cai no neutro', async () => {
    queryClient.setQueryData(chaves.atletica(), { ...atletica, corSecundaria: null })
    const { result } = await renderAtletica()
    expect(result.current.corSecundaria).toBe(COR_NEUTRA)
  })
})

describe('ProvedorTema', () => {
  it('gera as variáveis --cor-primaria e --cor-secundaria', () => {
    expect(variaveisTema({ corPrimaria: '#E11D48', corSecundaria: '#2563EB' })).toEqual({
      '--cor-primaria': '225 29 72',
      '--cor-secundaria': '37 99 235',
    })
  })

  it('aplica as variáveis da atlética no contêiner raiz', async () => {
    // O objeto de vars() é opaco fora do Metro; o espião expõe o que chega ao contêiner.
    const espiao = jest
      .spyOn(nativewind, 'vars')
      .mockImplementation((v) => ({ variaveis: JSON.stringify(v) }))
    queryClient.setQueryData(chaves.atletica(), atletica)
    await render(
      <ProvedorTema>
        <Text>conteúdo</Text>
      </ProvedorTema>,
      { wrapper: comQuery },
    )

    expect(StyleSheet.flatten(screen.getByTestId('provedor-tema').props.style)).toEqual({
      variaveis: JSON.stringify({ '--cor-primaria': '225 29 72', '--cor-secundaria': '37 99 235' }),
    })
    expect(screen.getByText('conteúdo')).toBeOnTheScreen()
    espiao.mockRestore()
  })
})
